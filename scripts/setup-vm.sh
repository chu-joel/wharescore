#!/bin/bash
# WhareScore — VM Setup Script
# Run this ONCE after SSH'ing into the Azure VM.
#
# Usage:
#   ssh wharescore@<VM_IP>
#   bash setup-vm.sh

set -euo pipefail

echo "=== WhareScore VM Setup ==="

# 1. System updates
echo ">>> Installing system updates"
sudo apt-get update && sudo apt-get upgrade -y

# 2. Install Docker
echo ">>> Installing Docker"
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"

# 3. Format and mount data disk (only if not already mounted)
if ! mountpoint -q /data 2>/dev/null; then
    echo ">>> Setting up data disk"

    # Find the data disk (usually /dev/sdc on Azure)
    DATA_DISK=""
    for disk in /dev/sd{c,d,e}; do
        if [ -b "$disk" ] && ! mount | grep -q "$disk"; then
            DATA_DISK="$disk"
            break
        fi
    done

    if [ -z "$DATA_DISK" ]; then
        echo "ERROR: No unmounted data disk found. Check lsblk output."
        lsblk
        exit 1
    fi

    echo ">>> Formatting $DATA_DISK as ext4"
    sudo mkfs.ext4 "$DATA_DISK"
    sudo mkdir -p /data
    sudo mount "$DATA_DISK" /data

    # Add to fstab for persistence
    UUID=$(sudo blkid -s UUID -o value "$DATA_DISK")
    echo "UUID=$UUID /data ext4 defaults,nofail 0 2" | sudo tee -a /etc/fstab

    echo ">>> Data disk mounted at /data"
else
    echo ">>> /data already mounted, skipping"
fi

# 4. Create directories
echo ">>> Creating directories"
sudo mkdir -p /data/postgres
sudo chown -R 999:999 /data/postgres  # postgres container UID
sudo mkdir -p /data/backups
mkdir -p ~/app

# 5. Install fail2ban for SSH protection
echo ">>> Installing fail2ban"
sudo apt-get install -y fail2ban
sudo systemctl enable fail2ban

# 6. Configure automatic security updates
echo ">>> Enabling unattended-upgrades"
sudo apt-get install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# 7. Harden SSH
echo ">>> Hardening SSH config"
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart sshd

echo ""
echo "=== Setup Complete ==="
echo ""
echo "IMPORTANT: Log out and back in for Docker group to take effect:"
echo "  exit"
echo "  ssh wharescore@<VM_IP>"
echo ""
echo "Then copy your project files to ~/app/ and start Docker Compose."
