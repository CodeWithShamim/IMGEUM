import {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useAccount, useReadContract} from 'wagmi';
import {parseEther} from 'viem';
import type {Abi} from 'viem';
import {Layout} from '../components/layout/Layout';
import {TileWipe} from '../components/motion/TileWipe';
import {Button} from '../components/ui/Button';
import {Watermark} from '../components/ui/Watermark';
import {Badge} from '../components/ui/Badge';
import {SolvencyMeter} from '../components/ui/SolvencyMeter';
import {Stat} from '../components/ui/Stat';
import {VaultCard} from '../components/wage/VaultCard';
import {useImgeum} from '../hooks/useImgeum';
import {useEmployer} from '../hooks/useEmployer';
import {useEmployerVaultIds, useVaults} from '../hooks/useVaults';
import {useTx} from '../hooks/useTx';
import {useSecondsClock} from '../hooks/useClock';
import {vaultState, isNative, type Vault, type Address, NATIVE_TOKEN} from '../lib/vault';
import {formatKRW} from '../lib/format';
import {useLang} from '../hooks/useLang';

export default function Employer() {
  const {t} = useTranslation();
  const {address, isConnected} = useAccount();
  const {isDeployed} = useImgeum();
  const emp = useEmployer(address as Address | undefined);

  return (
    <Layout rail={t('common:nav.employer')}>
      <TileWipe>
        <div className="relative mx-auto max-w-6xl px-4 py-8">
          <Watermark text="신뢰" className="-left-4 top-24 opacity-[0.05]" />
          <header className="mb-6">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-cheong">{t('employer:subtitle')}</p>
            <h1 className="font-display text-4xl font-extrabold sm:text-5xl">{t('employer:title')}</h1>
          </header>

          {!isConnected ? (
            <Prompt msg={t('employer:connectPrompt')} />
          ) : !isDeployed ? (
            <Prompt msg={t('common:empty.notDeployed')} tone="vermil" />
          ) : !emp.isRegistered ? (
            <RegisterPanel onDone={emp.refetch} />
          ) : (
            <RegisteredConsole employer={address as Address} emp={emp} />
          )}
        </div>
      </TileWipe>
    </Layout>
  );
}

/* ------------------------------ registration ----------------------------- */

function RegisterPanel({onDone}: {onDone: () => void}) {
  const {t} = useTranslation();
  const {address} = useAccount();
  const {registry, dojang, attesterId, isMock} = useImgeum();
  const {send, pending} = useTx();
  const [upId, setUpId] = useState('');
  const [name, setName] = useState('');

  // Live Dojang status for the connected wallet.
  const verified = useReadContract({
    address: registry?.address as Address,
    abi: registry?.abi as Abi,
    functionName: 'isCurrentlyDojangVerified',
    args: address ? [address] : undefined,
    query: {enabled: !!registry && !!address},
  });
  const isVerified = (verified.data as boolean | undefined) ?? false;

  // Mock verifier self-enroll (demo only).
  const mockVerify = async () => {
    if (!dojang || !attesterId) return;
    const ok = await send(
      {
        address: dojang as Address,
        abi: MOCK_DOJANG_ABI,
        functionName: 'selfVerify',
        args: [attesterId],
      },
      t('common:status.loading'),
      t('common:status.verified'),
    );
    if (ok) void verified.refetch();
  };

  const register = async () => {
    if (!registry) return;
    const ok = await send(
      {address: registry.address as Address, abi: registry.abi, functionName: 'register', args: [upId, name]},
      t('employer:register.registering'),
      t('employer:register.success'),
    );
    if (ok) onDone();
  };

  return (
    <div className="mx-auto max-w-xl rounded border-2 border-ink bg-ink-2 p-6 shadow-hard-ink">
      <h2 className="font-display text-2xl font-bold">{t('employer:register.heading')}</h2>
      <p className="mt-2 text-sm text-hanji/70">{t('employer:register.body')}</p>

      <div className="mt-4 rounded border border-hanji/15 bg-ink p-3">
        {isVerified ? (
          <span className="flex items-center gap-2 text-sm text-nok">
            <Badge tone="nok">◆ {t('common:status.verified')}</Badge>
            {t('employer:register.gateVerified')}
          </span>
        ) : (
          <div>
            <span className="flex items-center gap-2 text-sm text-hanji/70">
              <Badge tone="muted">{t('common:status.unverified')}</Badge>
              {isMock ? t('employer:register.gateMock') : t('employer:register.gateUnverified')}
            </span>
            {isMock && (
              <div className="mt-3">
                <Button variant="nok" onClick={mockVerify} loading={pending}>
                  {t('employer:register.mockVerifyCta')}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 space-y-3">
        <Field
          label={t('employer:register.displayNameLabel')}
          value={name}
          onChange={setName}
          placeholder={t('employer:register.displayNamePlaceholder')}
        />
        <Field
          label={t('employer:register.upIdLabel')}
          value={upId}
          onChange={setUpId}
          placeholder={t('employer:register.upIdPlaceholder')}
          mono
        />
        <Button
          variant="cheong"
          full
          disabled={!isVerified || !name || !upId}
          loading={pending}
          onClick={register}
        >
          {t('employer:register.submit')}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------- console --------------------------------- */

function RegisteredConsole({employer, emp}: {employer: Address; emp: ReturnType<typeof useEmployer>}) {
  const {t} = useTranslation();
  const {data: ids} = useEmployerVaultIds(employer);
  const idList = useMemo(() => (ids as bigint[] | undefined) ?? [], [ids]);
  const {vaults, refetch} = useVaults(idList);
  const p = emp.profile;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
      {/* Fixed money column: identity + score + open form. */}
      <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="rounded border-2 border-ink bg-ink-2 p-4">
          <div className="flex items-center justify-between">
            <span className="font-display text-lg font-bold">{p?.displayName}</span>
            <Badge tone={emp.verifiedNow ? 'nok' : 'muted'}>
              {emp.verifiedNow ? t('common:status.verified') : t('common:status.unverified')}
            </Badge>
          </div>
          {p?.upId && <span className="font-mono text-xs text-jade-mist">{p.upId}</span>}
          <div className="mt-4">
            <SolvencyMeter score={emp.score} rated={emp.rated} />
            {!emp.rated && (
              <p className="mt-2 text-xs text-hanji/50">
                {t('employer:score.unratedBody', {n: 3})}
              </p>
            )}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Stat label={t('common:status.onTime')} value={p?.onTimeCount ?? 0} tone="nok" />
            <Stat label={t('common:status.breached')} value={p?.arrearsCount ?? 0} tone="vermil" />
            <Stat label={t('common:labels.vault')} value={p?.vaultsOpened ?? 0} tone="cheong" />
          </div>
        </div>

        <OpenVaultForm onDone={refetch} />
      </div>

      {/* Vault list. */}
      <div>
        <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-[0.2em] text-hanji/70">
          {t('employer:vaults.heading')}
        </h2>
        {vaults.length === 0 ? (
          <Prompt msg={t('common:empty.noVaults')} />
        ) : (
          <div className="space-y-3">
            {vaults.map((v) => (
              <EmployerVaultRow key={v.id.toString()} vault={v} onDone={refetch} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OpenVaultForm({onDone}: {onDone: () => void}) {
  const {t} = useTranslation();
  const {vault} = useImgeum();
  const {send, pending} = useTx();
  const [worker, setWorker] = useState('');
  const [wage, setWage] = useState('');
  const [days, setDays] = useState('30');

  const open = async () => {
    if (!vault) return;
    const now = Math.floor(Date.now() / 1000);
    const start = BigInt(now);
    const end = BigInt(now + Number(days) * 86400);
    const deadline = end + BigInt(3 * 86400);
    const ok = await send(
      {
        address: vault.address as Address,
        abi: vault.abi,
        functionName: 'openVault',
        args: [worker as Address, parseEther(wage || '0'), start, end, deadline, NATIVE_TOKEN],
      },
      t('employer:open.opening'),
      t('employer:open.success'),
    );
    if (ok) {
      setWorker('');
      setWage('');
      onDone();
    }
  };

  const valid = worker.startsWith('0x') && worker.length === 42 && Number(wage) > 0;

  return (
    <div className="rounded border-2 border-ink bg-ink-2 p-4">
      <h3 className="font-display text-lg font-bold">{t('employer:open.heading')}</h3>
      <div className="mt-3 space-y-3">
        <Field label={t('employer:open.workerLabel')} value={worker} onChange={setWorker} placeholder={t('employer:open.workerPlaceholder')} mono />
        <Field label={`${t('employer:open.wageLabel')} (ETH)`} value={wage} onChange={setWage} placeholder="1.5" mono />
        <Field label={`${t('employer:open.endLabel')} (${t('common:units.perMonth')})`} value={days} onChange={setDays} placeholder="30" mono />
        <Button variant="cheong" full disabled={!valid} loading={pending} onClick={open}>
          {t('employer:open.submit')}
        </Button>
      </div>
    </div>
  );
}

function EmployerVaultRow({vault, onDone}: {vault: Vault; onDone: () => void}) {
  const {t} = useTranslation();
  const {lang} = useLang();
  const {vault: vaultContract} = useImgeum();
  const {send, pending} = useTx();
  const now = useSecondsClock();
  const [fundAmt, setFundAmt] = useState('');
  const state = vaultState(vault, now);
  const native = isNative(vault.token);

  const fund = async () => {
    if (!vaultContract || !fundAmt) return;
    const value = parseEther(fundAmt);
    const ok = await send(
      {
        address: vaultContract.address as Address,
        abi: vaultContract.abi,
        functionName: 'fund',
        args: [vault.id, value],
        value: native ? value : 0n,
      },
      t('employer:vaults.funding'),
      t('employer:vaults.funded', {amount: native ? formatKRW(value, lang) : fundAmt}),
    );
    if (ok) {
      setFundAmt('');
      onDone();
    }
  };

  const close = async () => {
    if (!vaultContract) return;
    const ok = await send(
      {address: vaultContract.address as Address, abi: vaultContract.abi, functionName: 'closeVault', args: [vault.id]},
      t('employer:vaults.closing'),
      t('employer:vaults.closed'),
    );
    if (ok) onDone();
  };

  const canClose = state !== 'streaming' && state !== 'pending' && !vault.closed;

  return (
    <VaultCard vault={vault} role="employer">
      {!vault.closed && (
        <div className="flex w-full flex-wrap items-end gap-2">
          <div className="min-w-[7rem] flex-1">
            <input
              value={fundAmt}
              onChange={(e) => setFundAmt(e.target.value)}
              placeholder={`${t('employer:vaults.fundAmount')} (ETH)`}
              className="w-full rounded border-2 border-ink bg-ink px-3 py-2 font-mono text-sm text-hanji placeholder:text-hanji/30 focus:border-cheong focus:outline-none"
              inputMode="decimal"
            />
          </div>
          <Button variant="gold" onClick={fund} loading={pending} disabled={!fundAmt}>
            {t('employer:vaults.fundSubmit')}
          </Button>
          {canClose && (
            <Button variant="ghost" onClick={close} loading={pending}>
              {t('employer:vaults.closeCta')}
            </Button>
          )}
        </div>
      )}
    </VaultCard>
  );
}

/* -------------------------------- shared --------------------------------- */

function Field({
  label,
  value,
  onChange,
  placeholder,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-hanji/50">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-1 w-full rounded border-2 border-ink bg-ink px-3 py-2 text-sm text-hanji placeholder:text-hanji/30 focus:border-cheong focus:outline-none ${mono ? 'font-mono' : ''}`}
      />
    </label>
  );
}

function Prompt({msg, tone}: {msg: string; tone?: 'vermil'}) {
  return (
    <div
      className={`rounded border-2 border-dashed p-10 text-center ${tone === 'vermil' ? 'border-vermil/30 text-vermil/80' : 'border-hanji/20 text-hanji/60'}`}
    >
      {msg}
    </div>
  );
}

// Minimal ABI for the demo mock verifier's selfVerify (present only on mock deployments).
const MOCK_DOJANG_ABI = [
  {type: 'function', name: 'selfVerify', stateMutability: 'nonpayable', inputs: [{name: 'attesterId', type: 'bytes32'}], outputs: []},
] as const;
