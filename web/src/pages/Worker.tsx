import {useMemo, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigate} from 'react-router-dom';
import {useAccount, useWatchContractEvent} from 'wagmi';
import {Layout} from '../components/layout/Layout';
import {TileWipe} from '../components/motion/TileWipe';
import {WageStream, type WageStreamHandle} from '../components/wage/WageStream';
import {VaultCard} from '../components/wage/VaultCard';
import {Button} from '../components/ui/Button';
import {Watermark} from '../components/ui/Watermark';
import {useImgeum} from '../hooks/useImgeum';
import {useWorkerVaultIds, useVaults} from '../hooks/useVaults';
import {useTx} from '../hooks/useTx';
import {useSecondsClock} from '../hooks/useClock';
import {useLang} from '../hooks/useLang';
import {withdrawableAt, vaultState, isNative, type Vault, type Address} from '../lib/vault';
import {formatKRW, formatToken} from '../lib/format';
import type {Abi} from 'viem';

export default function Worker() {
  const {t} = useTranslation();
  const {address, isConnected} = useAccount();
  const {vault: vaultContract, attestor, isDeployed} = useImgeum();
  const {data: ids} = useWorkerVaultIds(address as Address | undefined);
  const idList = useMemo(() => (ids as bigint[] | undefined) ?? [], [ids]);
  const {vaults, refetch} = useVaults(idList);
  const now = useSecondsClock();
  const streamRef = useRef<WageStreamHandle>(null);

  // Live event subscription: pulse the stream when the employer funds (spec §4).
  useWatchContractEvent({
    address: vaultContract?.address as Address | undefined,
    abi: vaultContract?.abi as Abi | undefined,
    eventName: 'VaultFunded',
    enabled: isDeployed && !!vaultContract,
    onLogs: () => {
      streamRef.current?.burst();
      void refetch();
    },
  });

  const active = vaults.filter((v) => vaultState(v, now) === 'streaming' || vaultState(v, now) === 'pending');
  const breached = vaults.filter((v) => vaultState(v, now) === 'breached');
  const settled = vaults.filter((v) => vaultState(v, now) === 'settled');
  const primary = active[0] ?? breached[0] ?? vaults[0];

  return (
    <Layout rail={t('common:nav.worker')}>
      <TileWipe>
        <div className="relative mx-auto max-w-6xl px-4 py-8">
          <Watermark text="임금" className="-right-4 top-10 opacity-[0.06]" />

          <header className="mb-6">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-nok">{t('worker:subtitle')}</p>
            <h1 className="font-display text-4xl font-extrabold sm:text-5xl">{t('worker:title')}</h1>
          </header>

          {!isConnected ? (
            <ConnectPrompt msg={t('worker:connectPrompt')} />
          ) : !isDeployed ? (
            <NotDeployed msg={t('common:empty.notDeployed')} />
          ) : vaults.length === 0 ? (
            <EmptyState msg={t('common:empty.noVaults')} />
          ) : (
            // Off-center split: fixed money column left, actions/history right (spec §5).
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
                {primary && <WageStream ref={streamRef} vault={primary} />}
                {primary && <WithdrawPanel vault={primary} onDone={refetch} />}
              </div>

              <div className="space-y-6">
                {breached.length > 0 && (
                  <section>
                    <SectionTitle text={t('worker:arrearsVaults')} tone="vermil" />
                    <div className="mt-3 space-y-3">
                      {breached.map((v) => (
                        <BreachedVault key={v.id.toString()} vault={v} onDone={refetch} attestorAddr={attestor?.address as Address} attestorAbi={attestor?.abi as Abi} />
                      ))}
                    </div>
                  </section>
                )}

                {active.length > 0 && (
                  <section>
                    <SectionTitle text={t('worker:activeVaults')} tone="nok" />
                    <div className="mt-3 space-y-3">
                      {active.map((v) => (
                        <VaultCard key={v.id.toString()} vault={v} role="worker">
                          <WithdrawButton vault={v} onDone={refetch} inline />
                        </VaultCard>
                      ))}
                    </div>
                  </section>
                )}

                {settled.length > 0 && (
                  <section>
                    <SectionTitle text={t('worker:settledVaults')} tone="muted" />
                    <div className="mt-3 space-y-3">
                      {settled.map((v) => (
                        <VaultCard key={v.id.toString()} vault={v} role="worker" />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>
          )}
          <FaucetHint />
        </div>
      </TileWipe>
    </Layout>
  );
}

function WithdrawPanel({vault, onDone}: {vault: Vault; onDone: () => void}) {
  const {t} = useTranslation();
  const {lang} = useLang();
  const now = useSecondsClock();
  const w = withdrawableAt(vault, now);
  const native = isNative(vault.token);
  const label = native ? formatKRW(w, lang) : `${formatToken(w)} ${t('common:units.krw')}`;
  return (
    <div className="rounded border-2 border-ink bg-ink-2 p-4">
      <div className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-hanji/50">
        {t('worker:withdrawableNow')}
      </div>
      <div className="mt-1 font-mono text-2xl font-bold tnum text-nok">{label}</div>
      <div className="mt-3">
        <WithdrawButton vault={vault} onDone={onDone} />
      </div>
    </div>
  );
}

function WithdrawButton({vault, onDone, inline}: {vault: Vault; onDone: () => void; inline?: boolean}) {
  const {t} = useTranslation();
  const {lang} = useLang();
  const {vault: vaultContract} = useImgeum();
  const {send, pending} = useTx();
  const now = useSecondsClock();
  const w = withdrawableAt(vault, now);
  const disabled = w === 0n;
  const label = isNative(vault.token) ? formatKRW(w, lang) : `${formatToken(w)}`;

  const onWithdraw = async () => {
    if (!vaultContract) return;
    const ok = await send(
      {address: vaultContract.address as Address, abi: vaultContract.abi, functionName: 'withdraw', args: [vault.id]},
      t('worker:withdrawing'),
      t('worker:withdrawSuccess', {amount: label}),
    );
    if (ok) onDone();
  };

  return (
    <Button variant="gold" onClick={onWithdraw} disabled={disabled} loading={pending} full={!inline}>
      {disabled ? t('worker:nothingToWithdraw') : t('worker:withdrawCta', {amount: label})}
    </Button>
  );
}

function BreachedVault({
  vault,
  onDone,
  attestorAddr,
  attestorAbi,
}: {
  vault: Vault;
  onDone: () => void;
  attestorAddr?: Address;
  attestorAbi?: Abi;
}) {
  const {t} = useTranslation();
  const {send, pending} = useTx();
  const navigate = useNavigate();

  const onAttest = async () => {
    if (!attestorAddr || !attestorAbi) return;
    const ok = await send(
      {address: attestorAddr, abi: attestorAbi, functionName: 'attestArrears', args: [vault.id]},
      t('worker:arrears.recording'),
      t('worker:arrears.recorded'),
    );
    // Once attested, the evidence record is reachable by its vault id.
    if (ok) {
      onDone();
      navigate(`/evidence/vault-${vault.id.toString()}`);
    }
  };

  return (
    <VaultCard vault={vault} role="worker">
      {!vault.arrearsAttested ? (
        <Button variant="vermil" onClick={onAttest} loading={pending}>
          {t('worker:arrears.cta')}
        </Button>
      ) : (
        <Button variant="ghost" onClick={() => navigate(`/evidence/vault-${vault.id.toString()}`)}>
          {t('worker:arrears.viewEvidence')}
        </Button>
      )}
      <WithdrawButton vault={vault} onDone={onDone} inline />
    </VaultCard>
  );
}

function SectionTitle({text, tone}: {text: string; tone: 'nok' | 'vermil' | 'muted'}) {
  const color = tone === 'nok' ? 'text-nok' : tone === 'vermil' ? 'text-vermil' : 'text-hanji/60';
  return (
    <h2 className={`flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.2em] ${color}`}>
      <span className="h-px w-6 bg-current" />
      {text}
    </h2>
  );
}

function ConnectPrompt({msg}: {msg: string}) {
  return <div className="rounded border-2 border-dashed border-hanji/20 p-10 text-center text-hanji/60">{msg}</div>;
}
function NotDeployed({msg}: {msg: string}) {
  return <div className="rounded border-2 border-dashed border-vermil/30 p-10 text-center text-vermil/80">{msg}</div>;
}
function EmptyState({msg}: {msg: string}) {
  return <div className="rounded border-2 border-dashed border-hanji/20 p-10 text-center text-hanji/60">{msg}</div>;
}

function FaucetHint() {
  const {t} = useTranslation();
  return (
    <div className="mt-8 text-center">
      <a
        href="https://faucet.giwa.io/"
        target="_blank"
        rel="noreferrer"
        className="text-xs text-jade-mist/70 hover:text-cheong"
      >
        {t('common:actions.getTestEth')} ↗
      </a>
    </div>
  );
}
