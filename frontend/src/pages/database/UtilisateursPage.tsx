import { useState, useEffect } from 'react';
import CrudPage, { type ColumnDef, type FieldDef } from './CrudPage';
import { useAuth } from '@/context/AuthContext';
import { ROLES } from '@/constants/roles';
import { db } from '@/api/database';

const ROLE_OPTIONS = [
  { value: 'Admin_app',  label: 'Admin App' },
  { value: 'Admin_data', label: 'Admin Data' },
  { value: 'User',       label: 'Utilisateur' },
  { value: 'Viewer',     label: 'Lecteur' },
];

const columns: ColumnDef[] = [
  {
    key: 'avatar_url',
    label: '',
    render: (v, row?: Record<string, unknown>) => {
      const url  = String(v ?? '');
      const nom  = String(row?.nom ?? '');
      if (url) {
        return (
          <img
            src={url}
            alt="avatar"
            style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', verticalAlign: 'middle', border: '1px solid #232B3E' }}
          />
        );
      }
      const inits  = nom.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
      const colors = ['#0078D4','#107C10','#D83B01','#5C2D91','#038387','#CA5010','#00B294','#B4009E'];
      let h = 0; for (const c of nom) h = (h * 31 + c.charCodeAt(0)) | 0;
      const bg = inits ? colors[Math.abs(h) % colors.length] : '#232B3E';
      return (
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px', verticalAlign: 'middle', flexShrink: 0 }}>
          {inits || (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          )}
        </div>
      );
    },
  },
  { key: 'nom',                  label: 'Nom',           sortable: true },
  { key: 'email',                label: 'Email' },
  { key: 'role',                 label: 'Rôle',          sortable: true },
  { key: 'niveau_accreditation', label: 'Accréditation', sortable: true },
  { key: 'actif',                label: 'Actif', render: v => v ? '✓' : '✗' },
  { key: 'last_activity_at',     label: 'Dernière activité', render: v => v ? new Date(v as string).toLocaleString('fr-FR') : '—' },
];

export default function UtilisateursPage() {
  const { user } = useAuth();
  const [accred, setAccred] = useState({ min: 0, max: 4 });

  useEffect(() => {
    db.fetchConfig()
      .then(({ data }) => setAccred(data.accreditation))
      .catch(() => {}); // fallback silencieux sur les valeurs par défaut
  }, []);

  const fields: FieldDef[] = [
    { key: 'avatar_url',           label: 'Photo de profil',  type: 'avatar',   nameField: 'nom' },
    { key: 'nom',                  label: 'Nom',              type: 'text',     required: true, layoutGroup: 'nom_actif' },
    { key: 'actif',                label: 'Actif',            type: 'boolean',  layoutGroup: 'nom_actif', layoutFlex: '0 0 auto' },
    { key: 'email',                label: 'Email',            type: 'email',    required: true },
    { key: 'password',             label: 'Mot de passe',     type: 'password', createRequired: true },
    { key: 'role',                 label: 'Rôle',             type: 'select',   options: ROLE_OPTIONS,  layoutGroup: 'role_accred' },
    { key: 'niveau_accreditation', label: 'Accréditation',    type: 'number',   min: accred.min, max: accred.max, layoutGroup: 'role_accred' },
  ];

  if (user?.role !== ROLES.ADMIN_APP) {
    return (
      <div style={{ padding: 40, color: '#6B7A99', fontFamily: '"Segoe UI", sans-serif' }}>
        Accès réservé à Admin_app.
      </div>
    );
  }

  return (
    <CrudPage
      entity="user_profiles"
      title="Utilisateurs"
      columns={columns}
      fields={fields}
      canWrite
      canCreate
      searchKeys={['nom', 'role']}
    />
  );
}
