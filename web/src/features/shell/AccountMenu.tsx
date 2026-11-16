import { Button, Modal } from 'antd';
import { ExternalLink, Menu, UserRound } from 'lucide-react';
import { useState } from 'react';

import type { AccountMenuEntry } from './account-menu';
import { useAccountMenu } from './account-menu';

function MenuEntryButton({
  entry,
  onSelect,
}: {
  entry: AccountMenuEntry;
  onSelect: (key: string) => void;
}) {
  const Icon = entry.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(entry.key)}
      className={`flex w-full items-center gap-3 rounded-md px-2.5 py-2.5 text-left text-[13px] transition-colors hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand ${
        entry.danger ? 'text-danger' : 'text-ink-soft'
      }`}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{entry.label}</span>
      {entry.external ? (
        <ExternalLink className="size-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
      ) : null}
    </button>
  );
}

export function AccountMenuDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const account = useAccountMenu();

  const handleSelect = (key: string) => {
    onClose();
    account.select(key);
  };

  return (
    <Modal open={open} onCancel={onClose} title="菜单" footer={null} width={360} destroyOnHidden>
      <div className="mt-1 mb-3 flex items-center gap-3 rounded-panel border border-line bg-surface-sunken/60 px-3 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
          <UserRound className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="m-0 truncate text-[13px] font-medium text-ink">{account.displayName}</p>
          <p className="m-0 mt-0.5 text-[11px] text-ink-subtle">{account.roleLabel}</p>
        </div>
      </div>
      <div>
        {account.sections.map((section, index) => (
          <div key={index} className={index > 0 ? 'mt-2 border-t border-line pt-2' : undefined}>
            {section.map((entry) => (
              <MenuEntryButton key={entry.key} entry={entry} onSelect={handleSelect} />
            ))}
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function AccountMenuButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        className={className}
        type="text"
        size="small"
        icon={<Menu className="size-4" aria-hidden="true" />}
        aria-label="打开菜单"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        菜单
      </Button>
      <AccountMenuDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
