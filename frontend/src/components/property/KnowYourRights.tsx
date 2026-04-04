'use client';

import { Scale, Shield, Wifi, Wrench, DollarSign, Home } from 'lucide-react';
import type { PropertyReport } from '@/lib/types';

interface Props {
  report: PropertyReport;
}

interface RightItem {
  icon: typeof Scale;
  title: string;
  detail: string;
  source: string;
}

/**
 * Context-specific "Know Your Rights" panel for renters.
 * Shows rights the tenant may not know about, personalized to the property.
 * Based on Residential Tenancies Act 1986 (as amended 2024).
 */
export function KnowYourRights({ report }: Props) {
  const hazards = report.hazards;
  const market = report.market;
  const medianRent = market?.rent_assessment?.median;

  const rights: RightItem[] = [];

  // Healthy Homes — always show (most tenants don't know this)
  rights.push({
    icon: Home,
    title: 'Demand the Healthy Homes compliance statement',
    detail: 'Since July 2025, every rental must comply with Healthy Homes Standards. Your landlord must give you a signed compliance statement — ask for it before signing.',
    source: 'Residential Tenancies Act s45(1A)',
  });

  // Bond maximum
  if (medianRent) {
    const maxBond = medianRent * 4;
    const maxPetBond = medianRent * 2;
    rights.push({
      icon: DollarSign,
      title: `Your bond cannot exceed $${maxBond.toLocaleString()}`,
      detail: `At $${medianRent}/wk, the maximum bond is 4 weeks ($${maxBond.toLocaleString()}). Pet bond: up to 2 extra weeks ($${maxPetBond.toLocaleString()}) from Dec 2025. Verify your bond was lodged at tenancy.govt.nz within 23 working days.`,
      source: 'RTA s19',
    });
  }

  // Rent increase rules
  rights.push({
    icon: DollarSign,
    title: 'Rent can only increase once every 12 months',
    detail: 'Your landlord must give 60 days written notice. You can challenge any increase at the Tenancy Tribunal within 28 days if it\'s above market rate for similar properties.',
    source: 'RTA s24',
  });

  // Modification rights — earthquake zone makes this especially relevant
  const isEqZone = (hazards?.earthquake_count ?? 0) > 5 || hazards?.active_fault_nearest != null;
  rights.push({
    icon: Wrench,
    title: 'You can install shelves, picture hooks, and baby gates',
    detail: `These are "minor changes" your landlord cannot refuse. ${isEqZone ? 'In this seismic area, you can also secure furniture to walls for earthquake safety.' : 'You can also secure furniture to walls for earthquake safety.'} Request in writing — landlord must respond within 21 days.`,
    source: 'RTA s42A',
  });

  // Fibre broadband
  rights.push({
    icon: Wifi,
    title: 'You can request fibre broadband installation',
    detail: 'If the standard install is free to the landlord (most UFB installs are), they must agree unless there are structural concerns. Request in writing.',
    source: 'RTA s42C',
  });

  // Quiet enjoyment
  rights.push({
    icon: Shield,
    title: 'Your landlord needs 48 hours notice to inspect',
    detail: 'Inspections: 48 hours written notice, max once per 4 weeks, between 8am-7pm. Repairs: 24 hours notice. Your landlord cannot enter without notice except in genuine emergencies.',
    source: 'RTA s48',
  });

  // Letting fees
  rights.push({
    icon: Scale,
    title: 'You should never pay a letting fee',
    detail: 'Letting fees have been illegal since December 2018. If an agent asks you to pay one, report it to Tenancy Services.',
    source: 'RTA s17(4A)',
  });

  return (
    <div className="rounded-xl border border-border bg-card p-4 card-elevated">
      <div className="flex items-center gap-2 mb-1">
        <Scale className="h-4 w-4 text-piq-primary" />
        <span className="text-sm font-bold">Know your rights</span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        NZ tenant protections most renters don't know about
      </p>

      <div className="space-y-3">
        {rights.map((right) => {
          const Icon = right.icon;
          return (
            <div key={right.title} className="flex items-start gap-2.5">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-piq-primary/10 shrink-0 mt-0.5">
                <Icon className="h-3.5 w-3.5 text-piq-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{right.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{right.detail}</p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground mt-3 pt-2 border-t border-border">
        Source: Residential Tenancies Act 1986, amended 2024. Free help at tenancy.govt.nz or 0800 TENANCY.
      </p>
    </div>
  );
}
