import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAPI, useQuery, useMutation } from '../hooks/useAPI';
import { useToast } from './Toast';
import type {
  Project,
  AgentType,
  AgentRole,
  SecurityEvent,
  RoleDefinition,
  RoleDefinitions,
  SchemaGateState,
} from '../../shared/types';
import { AGENTS } from '../../shared/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES: AgentRole[] = ['lead', 'engineer', 'reviewer', 'tester', 'documenter'];

const ROLE_COLORS: Record<AgentRole, string> = {
  lead:       '#a78bfa',
  engineer:   '#34d399',
  reviewer:   '#60a5fa',
  tester:     '#fbbf24',
  documenter: '#f472b6',
};

const MODEL_TIER_LABEL: Record<string, string> = {
  frontier:    'Frontier',
  performance: 'Performance',
  efficient:   'Efficient',
};

// ─── Agent icon ───────────────────────────────────────────────────────────────

function AgentIcon({ agentType, className }: { agentType: AgentType; className?: string }) {
  const cls = className ?? 'w-4 h-4';
  switch (agentType) {
    case 'claude':
      return (
        <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="2" width="14" height="12" rx="2" />
          <polyline points="4 7 6 9 4 11" />
          <line x1="8" y1="11" x2="12" y2="11" />
        </svg>
      );
    case 'gemini':
      return (
        <svg className={cls} viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0C8 4.42 4.42 8 0 8c4.42 0 8 3.58 8 8 0-4.42 3.58-8 8-8-4.42 0-8-3.58-8-8z" />
        </svg>
      );
    case 'codex':
      return (
        <svg className={cls} viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0L14.93 4v8L8 16 1.07 12V4L8 0zm0 1.6L2.47 4.8v6.4L8 14.4l5.53-3.2V4.8L8 1.6z" />
          <circle cx="8" cy="8" r="2.5" />
        </svg>
      );
    case 'copilot':
      return (
        <svg className={cls} viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1L9.5 6.5H15L10.5 9.5L12 15L8 12L4 15L5.5 9.5L1 6.5H6.5Z" />
        </svg>
      );
    default:
      return null;
  }
}

// ─── Event badge ──────────────────────────────────────────────────────────────

function EventBadge({ event }: { event: SecurityEvent['event'] }) {
  if (event === 'allowed') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-400">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
        allowed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-400">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
      blocked
    </span>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Role selector ────────────────────────────────────────────────────────────

function RoleSelector({
  current,
  onChange,
  roles,
  loading,
}: {
  current: AgentRole;
  onChange: (role: AgentRole) => void;
  roles: RoleDefinitions | null;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={loading}
        className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] transition-colors disabled:opacity-50"
        style={{ color: ROLE_COLORS[current] }}
      >
        {roles?.[current]?.displayName ?? current}
        <svg className="w-3 h-3 opacity-50" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-1 z-20 min-w-[180px] rounded-xl bg-bg-panel border border-white/[0.1] shadow-xl overflow-hidden"
          >
            {ROLES.map(role => (
              <button
                key={role}
                onClick={() => { onChange(role); setOpen(false); }}
                className={`w-full text-left px-3 py-2.5 text-xs hover:bg-white/[0.05] transition-colors flex items-start gap-2.5 ${role === current ? 'bg-white/[0.04]' : ''}`}
              >
                <span className="mt-0.5 w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ROLE_COLORS[role] }} />
                <div>
                  <div className="font-medium text-text-primary">{roles?.[role]?.displayName ?? role}</div>
                  {roles?.[role]?.description && (
                    <div className="text-text-muted mt-0.5 leading-relaxed">{roles[role].description}</div>
                  )}
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      {open && <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />}
    </div>
  );
}

// ─── Spatial partition input ──────────────────────────────────────────────────

function SpatialPartitionInput({
  value,
  onChange,
  agentName,
}: {
  value: string;
  onChange: (v: string) => void;
  agentName: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={`e.g. src/${agentName.toLowerCase()}/**`}
      className="text-xs bg-white/[0.03] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-text-secondary placeholder:text-text-muted/50 focus:outline-none focus:border-accent/40 w-full font-mono"
    />
  );
}

// ─── Role detail panel ────────────────────────────────────────────────────────

function RoleDetailPanel({ role, def }: { role: AgentRole; def: RoleDefinition }) {
  return (
    <div className="mt-2 text-xs space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {def.capabilities.map(cap => (
          <span key={cap} className="px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.07] text-text-muted">
            {cap}
          </span>
        ))}
      </div>
      <div className="text-text-muted">
        <span className="text-text-secondary font-medium">Tools ({def.tools.length}): </span>
        {def.tools.join(', ')}
      </div>
      {def.fileRestrictions && (
        <div className="text-text-muted">
          <span className="text-text-secondary font-medium">Write allowed: </span>
          <span className="font-mono">{def.fileRestrictions.writeAllowed.join(', ')}</span>
        </div>
      )}
      {def.commandRestrictions && (
        <div className="text-text-muted">
          <span className="text-text-secondary font-medium">Commands: </span>
          {def.commandRestrictions.allowed.join(', ')}
        </div>
      )}
      <div className="text-text-muted">
        <span className="text-text-secondary font-medium">Model tier: </span>
        {MODEL_TIER_LABEL[def.modelTier] ?? def.modelTier}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SecurityDashboard({ project }: { project: Project }) {
  const api = useAPI();
  const { toast } = useToast();
  const [expandedAgent, setExpandedAgent] = useState<AgentType | null>(null);
  const [partitionDrafts, setPartitionDrafts] = useState<Partial<Record<AgentType, string>>>({});
  const [showAllLogs, setShowAllLogs] = useState(false);

  const {
    data: state,
    loading: stateLoading,
    refetch: refetchState,
  } = useQuery<SchemaGateState>(() => api.schemaGate.getState(project.path), [project.path]);

  const {
    data: auditLog,
    refetch: refetchLog,
  } = useQuery<SecurityEvent[]>(() => api.schemaGate.getAuditLog(project.path, showAllLogs ? 200 : 15), [project.path, showAllLogs]);

  const { data: roles } = useQuery<RoleDefinitions>(() => api.schemaGate.getRoles(), []);

  const toggleEnabled = useMutation(async () => {
    if (state?.enabled) {
      await api.schemaGate.disable(project.path);
      toast('Schema gating disabled');
    } else {
      await api.schemaGate.enable(project.path);
      toast('Schema gating enabled');
    }
    refetchState();
  });

  const assignRole = useMutation(async (agent: AgentType, role: AgentRole) => {
    const partition = partitionDrafts[agent] || undefined;
    await api.schemaGate.assignRole(project.path, agent, role, partition);
    toast(`${AGENTS[agent]?.displayName ?? agent} → ${roles?.[role]?.displayName ?? role}`);
    refetchState();
    refetchLog();
  });

  const projectAgents: AgentType[] = project.agents?.length
    ? project.agents
    : [project.preferredAgent ?? 'claude'];

  const assignmentMap = new Map(state?.assignments.map(a => [a.agent, a]));

  return (
    <div className="max-w-2xl space-y-5">

      {/* Header toggle */}
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Schema Gating</h3>
            <p className="text-xs text-text-muted mt-1">
              {state?.enabled
                ? 'Active — agents can only access tools their role authorizes.'
                : 'Inactive — all agents have unrestricted tool access.'}
            </p>
          </div>
          <button
            onClick={() => toggleEnabled.mutate()}
            disabled={toggleEnabled.loading || stateLoading}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${
              state?.enabled ? 'bg-accent' : 'bg-white/[0.1]'
            } disabled:opacity-50`}
          >
            <motion.span
              layout
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm ${
                state?.enabled ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Active role assignments */}
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.05]">
          <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider">Active Roles</h3>
        </div>

        <div className="divide-y divide-white/[0.04]">
          {projectAgents.map(agentType => {
            const config = AGENTS[agentType];
            const assignment = assignmentMap.get(agentType);
            const currentRole: AgentRole = assignment?.role ?? 'engineer';
            const roleDef = roles?.[currentRole];
            const isExpanded = expandedAgent === agentType;

            return (
              <div key={agentType} className="px-5 py-4">
                <div className="flex items-center gap-3">
                  {/* Agent icon + name */}
                  <span style={{ color: config?.color }} className="flex-shrink-0">
                    <AgentIcon agentType={agentType} className="w-4 h-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">
                        {config?.displayName ?? agentType}
                      </span>
                      {assignment?.spatialPartition && (
                        <span className="text-[10px] font-mono text-text-muted bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 rounded truncate max-w-[180px]">
                          {assignment.spatialPartition}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expand details toggle */}
                  <button
                    onClick={() => setExpandedAgent(isExpanded ? null : agentType)}
                    className="text-text-muted hover:text-text-secondary transition-colors p-1"
                    title="Show role details"
                  >
                    <svg
                      className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                    >
                      <path d="M6 4l4 4-4 4" />
                    </svg>
                  </button>

                  {/* Role selector */}
                  <RoleSelector
                    current={currentRole}
                    onChange={role => assignRole.mutate(agentType, role)}
                    roles={roles ?? null}
                    loading={assignRole.loading}
                  />
                </div>

                {/* Expanded details */}
                <AnimatePresence>
                  {isExpanded && roleDef && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 pl-7">
                        <RoleDetailPanel role={currentRole} def={roleDef} />

                        {/* Spatial partition */}
                        <div className="mt-3">
                          <label className="text-xs text-text-muted mb-1 block">Spatial partition (optional)</label>
                          <div className="flex gap-2">
                            <SpatialPartitionInput
                              value={partitionDrafts[agentType] ?? assignment?.spatialPartition ?? ''}
                              onChange={v => setPartitionDrafts(d => ({ ...d, [agentType]: v }))}
                              agentName={agentType}
                            />
                            <button
                              onClick={() => assignRole.mutate(agentType, currentRole)}
                              disabled={assignRole.loading}
                              className="text-xs px-3 py-1.5 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 transition-colors flex-shrink-0 disabled:opacity-50"
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* Security event feed */}
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.05] flex items-center justify-between">
          <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider">Security Events</h3>
          <button
            onClick={() => { refetchLog(); }}
            className="text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            Refresh
          </button>
        </div>

        {!auditLog || auditLog.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-text-muted">No security events recorded yet.</p>
            <p className="text-xs text-text-muted/60 mt-1">Events appear when agents make tool calls.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {auditLog.map((ev, idx) => {
              const agentConfig = AGENTS[ev.agent];
              const isBlocked = ev.event !== 'allowed';
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="px-5 py-3 flex items-start gap-3"
                >
                  <span
                    className="flex-shrink-0 mt-0.5"
                    style={{ color: agentConfig?.color ?? '#888' }}
                  >
                    <AgentIcon agentType={ev.agent} className="w-3.5 h-3.5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-text-primary">
                        {agentConfig?.displayName ?? ev.agent}
                      </span>
                      {ev.role && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full border"
                          style={{ color: ROLE_COLORS[ev.role], borderColor: ROLE_COLORS[ev.role] + '40', backgroundColor: ROLE_COLORS[ev.role] + '14' }}>
                          {ev.role}
                        </span>
                      )}
                      <EventBadge event={ev.event} />
                    </div>
                    <p className={`text-xs mt-0.5 font-mono truncate ${isBlocked ? 'text-amber-400/80' : 'text-text-muted'}`}>
                      {ev.detail}
                    </p>
                  </div>
                  <span className="text-[10px] text-text-muted/60 flex-shrink-0 mt-0.5">
                    {relativeTime(ev.timestamp)}
                  </span>
                </motion.div>
              );
            })}
          </div>
        )}

        {auditLog && auditLog.length > 0 && (
          <div className="px-5 py-3 border-t border-white/[0.05]">
            <button
              onClick={() => setShowAllLogs(v => !v)}
              className="text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              {showAllLogs ? 'Show fewer events' : 'View full audit log'}
            </button>
          </div>
        )}
      </div>

      {/* Role reference */}
      {roles && (
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.05]">
            <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider">Role Reference</h3>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {ROLES.map(role => {
              const def = roles[role];
              if (!def) return null;
              return (
                <div key={role} className="px-5 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ROLE_COLORS[role] }} />
                    <span className="text-xs font-semibold text-text-primary">{def.displayName}</span>
                    <span className="text-[10px] text-text-muted/70 ml-auto">{MODEL_TIER_LABEL[def.modelTier]}</span>
                  </div>
                  <p className="text-xs text-text-muted pl-4">{def.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
