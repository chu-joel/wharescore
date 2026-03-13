#!/bin/bash
# WhareScore — Azure VM Deployment Script
#
# Prerequisites:
#   - Azure CLI installed and logged in (az login)
#   - SSH key pair (~/.ssh/id_rsa + id_rsa.pub)
#
# Usage:
#   chmod +x scripts/deploy-azure.sh
#   ./scripts/deploy-azure.sh
#
# After running, you'll need to:
#   1. Copy project files to the VM
#   2. Create .env.prod with real secrets
#   3. Restore the database dump
#   4. Start Docker Compose

set -euo pipefail

# --- Configuration ---
RESOURCE_GROUP="wharescore-rg"
LOCATION="australiaeast"
VM_NAME="wharescore-vm"
VM_SIZE="Standard_B2ms"
ADMIN_USER="wharescore"
OS_DISK_SIZE=64
DATA_DISK_SIZE=128

echo "=== Creating Azure resources for WhareScore ==="

# 1. Resource Group
echo ">>> Creating resource group: $RESOURCE_GROUP in $LOCATION"
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none

# 2. Create VM with data disk
echo ">>> Creating VM: $VM_NAME ($VM_SIZE)"
az vm create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$VM_NAME" \
  --image "Canonical:ubuntu-24_04-lts:server:latest" \
  --size "$VM_SIZE" \
  --admin-username "$ADMIN_USER" \
  --generate-ssh-keys \
  --public-ip-sku Standard \
  --os-disk-size-gb "$OS_DISK_SIZE" \
  --data-disk-sizes-gb "$DATA_DISK_SIZE" \
  --storage-sku Premium_LRS \
  --output table

# 3. Set DNS label (gives us wharescore-vm.australiaeast.cloudapp.azure.com)
echo ">>> Setting DNS label"
PUBLIC_IP_ID=$(az vm show --resource-group "$RESOURCE_GROUP" --name "$VM_NAME" \
  --query networkProfile.networkInterfaces[0].id -o tsv)
NIC_ID=$(az network nic show --ids "$PUBLIC_IP_ID" --query ipConfigurations[0].publicIPAddress.id -o tsv 2>/dev/null || true)

# Get the actual public IP resource
PUBLIC_IP_NAME=$(az vm list-ip-addresses --resource-group "$RESOURCE_GROUP" --name "$VM_NAME" \
  --query "[0].virtualMachine.network.publicIpAddresses[0].name" -o tsv)

az network public-ip update \
  --resource-group "$RESOURCE_GROUP" \
  --name "$PUBLIC_IP_NAME" \
  --dns-name "wharescore-vm" \
  --output none 2>/dev/null || echo "DNS label may already exist or name taken — check manually"

# 4. Get public IP
PUBLIC_IP=$(az vm list-ip-addresses --resource-group "$RESOURCE_GROUP" --name "$VM_NAME" \
  --query "[0].virtualMachine.network.publicIpAddresses[0].ipAddress" -o tsv)
echo ">>> VM public IP: $PUBLIC_IP"

# 5. Open ports (HTTP only — HTTPS via Cloudflare later)
echo ">>> Opening port 80 (HTTP)"
az vm open-port --resource-group "$RESOURCE_GROUP" --name "$VM_NAME" \
  --port 80 --priority 100 --output none

echo ""
echo "=== VM Created Successfully ==="
echo ""
echo "Public IP:  $PUBLIC_IP"
echo "DNS:        wharescore-vm.australiaeast.cloudapp.azure.com (if DNS label worked)"
echo "SSH:        ssh $ADMIN_USER@$PUBLIC_IP"
echo ""
echo "=== Next Steps ==="
echo ""
echo "1. SSH into the VM:"
echo "   ssh $ADMIN_USER@$PUBLIC_IP"
echo ""
echo "2. Run the setup script on the VM:"
echo "   curl -fsSL https://get.docker.com | sudo sh"
echo "   sudo usermod -aG docker \$USER && newgrp docker"
echo ""
echo "3. Format and mount the data disk:"
echo "   sudo mkfs.ext4 /dev/sdc"
echo "   sudo mkdir -p /data"
echo "   sudo mount /dev/sdc /data"
echo "   echo '/dev/sdc /data ext4 defaults,nofail 0 2' | sudo tee -a /etc/fstab"
echo "   sudo mkdir -p /data/postgres"
echo "   sudo chown -R 999:999 /data/postgres"
echo ""
echo "4. Copy project files from your local machine:"
echo "   scp -r docker-compose.prod.yml nginx/ backend/ frontend/ martin.prod.yaml postgres/ $ADMIN_USER@$PUBLIC_IP:~/app/"
echo ""
echo "5. Create .env.prod on the VM (see .env.prod.example)"
echo ""
echo "6. Start services:"
echo "   cd ~/app && docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build"
echo ""
echo "7. Restore database:"
echo "   pg_dump -U postgres -Fc wharescore > wharescore.dump"
echo "   scp wharescore.dump $ADMIN_USER@$PUBLIC_IP:~/app/"
echo "   ssh $ADMIN_USER@$PUBLIC_IP"
echo "   docker cp ~/app/wharescore.dump \$(docker ps -qf name=postgres):/tmp/"
echo "   docker exec \$(docker ps -qf name=postgres) pg_restore -U postgres -d wharescore --no-owner --no-privileges /tmp/wharescore.dump"
echo ""
echo "8. Verify:"
echo "   curl http://$PUBLIC_IP/health"
