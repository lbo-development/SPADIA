import { inputStyle as inp, Label } from '@/components/ui';

export type RefOption = { id: string; nom: string; site_id?: string; installation_id?: string | null };

export function SiteInstallSelect({ siteId, installId, onSiteChange, onInstallChange, sites, installations, siteLabel = 'Site', installLabel = 'Installation', installPlaceholder = '— Toutes —' }: {
  siteId: string;
  installId: string;
  onSiteChange: (id: string) => void;
  onInstallChange: (id: string) => void;
  sites: RefOption[];
  installations: RefOption[];
  siteLabel?: string;
  installLabel?: string;
  installPlaceholder?: string;
}) {
  const filtered = siteId ? installations.filter(i => i.site_id === siteId) : installations;
  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <div style={{ flex: 1 }}>
        <Label>{siteLabel}</Label>
        <select value={siteId} onChange={e => onSiteChange(e.target.value)} style={{ ...inp, height: 36 }}>
          <option value="">— Sélectionner un site —</option>
          {sites.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
        </select>
      </div>
      <div style={{ flex: 1 }}>
        <Label>{installLabel}</Label>
        <select value={installId} onChange={e => onInstallChange(e.target.value)}
          style={{ ...inp, height: 36, opacity: !siteId ? 0.45 : 1 }} disabled={!siteId}>
          <option value="">{installPlaceholder}</option>
          {filtered.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
        </select>
      </div>
    </div>
  );
}
