<div align="center">

# IMGEUM · 임금 프로토콜

**GIWA 체인 위에 구축한 지급능력 증명형 급여 · 임금체불 증빙 프로토콜.**

사업주의 지급 능력을 _지급일 이전에 보이게_ 하고, 미지급을 *단 한 번의 트랜잭션으로 증명*합니다.

[`English`](./README.md) · `한국어`

[GIWA](https://giwa.io)(업비트/두나무의 OP Stack L2) 기반 · **GASOK** 액셀러레이터 제출작

</div>

---

## 문제

한국은 OECD에서 임금체불률이 가장 높은 나라 중 하나입니다. 2023년 체불액은 **1조 7,800억 원**을 넘어
**27만 5천 명 이상**의 노동자가 피해를 입었습니다([고용노동부 2023 통계](https://www.moel.go.kr)).
가장 큰 타격을 받는 사람들 — 공장 노동자, 배달 라이더, 아르바이트, 이주노동자 — 은 지급일이 되어서야
사업주가 임금을 줄 수 없다는 사실을 알게 되고, 이후 몇 달 동안 노동청 제출용 증거를 직접 모아야 합니다.

## 해결책

IMGEUM은 두 개의 층으로 이뤄집니다.

1. **급여 스트리밍 에스크로.** Dojang 검증을 받은 사업주가 노동자별·주기별로 시간 잠금 볼트를 개설하고
   지속적으로 예치합니다. 노동자는 적립 임금이 실시간으로 쌓이는 것을 지켜봅니다 — GIWA의 1초 블록이
   카운터를 진짜로 _살아 움직이게_ 합니다.
2. **체불 증명(핵심 기능).** 지급 기한에 볼트가 부족하면 **누구나** `attestArrears()`를 호출해
   변경 불가능하고 시각이 기록된 온체인 증빙과 노동자에게 소울바운드 증빙 토큰을 발행할 수 있습니다.
   노동자는 법원·노동청 제출용 증빙 페이지를 내보낼 수 있으며, 열람에는 지갑이 필요 없습니다.
   **이 계층은 독립적 가치가 있어, 사업주가 협조하지 않아도 작동합니다.**

여기에 더해: **검증된 사업주**(Dojang 검증 주소), **사람이 읽을 수 있는 신원**(Upbit Web3 이름,
`name.up.id`), 그리고 채용 공고에 표시할 수 있는 공개 **임금 신뢰도 점수**를 제공합니다.

---

## 주요 기능

- ⏱️ **실시간 임금 스트림** — 적립 임금이 매 프레임 올라가고, `VaultFunded` 이벤트가 금빛 입자 폭발을
  일으켜 GIWA의 블록 속도를 *체감*하게 합니다.
- 🧾 **신뢰 불필요 증빙** — 모든 체불 기록은 GIWA의 OnchainVerifiable 패턴을 따르며 사업주의 Dojang
  증명 UID를 저장하여, EAS에서 직접 재확인할 수 있습니다.
- 🔒 **소울바운드 증거** — 증빙 토큰은 양도 불가능하며 소각할 수 없습니다.
- 🌏 **완전한 이중 언어(KO / EN)** — 한국어가 부가 기능이 아닌 1급 언어입니다. 번역되지 않은 문자열이
  하나라도 있으면 CI가 실패합니다.
- 🎨 **네오 단청 디자인 시스템** — 한국 사찰 지붕의 오방색을 디지털화. GIWA의 기와 정체성과 직결됩니다.
- 💸 **ETH + ERC-20** 임금 토큰 지원, 전송 수수료 토큰 안전 처리.

---

## Giya 심사 기준 매핑

| 기준                 | IMGEUM의 답                                                                                                                                                                                                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **왜 하필 GIWA인가** | 이 제품은 빠른 체인 위에서만 읽힙니다. GIWA의 **1초 블록** + **Flashblocks**(200ms 사전 확인)가 초당 임금 스트림을 겉치레가 아닌 실제로 만듭니다. **Dojang 검증 주소**는 노동자가 신뢰할 수 있는 사업주 신원을, **up.id**는 사람이 읽을 수 있는 주소를 제공합니다. 12초 L1에서는 성립하지 않습니다. |
| **독창성**           | 또 하나의 DeFi 프리미티브가 아닙니다. 구체적이고 문서화된 한국 사회 문제를 겨냥한 임금체불 _증빙_ 프로토콜이며, 증빙 계층은 사업주 채택이 0이어도 가치를 냅니다.                                                                                                                                    |
| **실현 가능성**      | 컨트랙트 완성, 74개 테스트 통과(단위+퍼즈+불변식, 라인 커버리지 95% 이상), 한 줄 명령 테스트넷 배포, TypeScript 오류 0의 완전 이중 언어 프론트엔드.                                                                                                                                                 |
| **시장 수요**        | 연 1조 7,800억 원 체불, 연 27만 5천 명 이상(고용노동부 2023). 노동청, 노조, 이주노동자 지원단체가 구체적 초기 사용자입니다.                                                                                                                                                                         |
| **GIWA 지갑 임베드** | `/worker` 화면은 지갑 인앱 탭으로 설계되었습니다: 모바일 우선, injected 커넥터 우선, 단일 주요 동작(출금), 스트림 전면 배치.                                                                                                                                                                        |

---

## 모노레포 구조

```
imgeum/
├── contracts/          Foundry 프로젝트 (Solidity ^0.8.28, OpenZeppelin v5)
│   ├── src/            EmployerRegistry · WageVault · ArrearsAttestor · GiwaConstants
│   │   ├── interfaces/ IDojangVerifier · IUpIdResolver · I{EmployerRegistry,WageVault}
│   ├── test/           단위 · 퍼즈 · 불변식 스위트
│   ├── script/         Deploy.s.sol (환경변수 기반, deployments/<chainId>.json 기록)
│   └── Makefile        make test / coverage / deploy-testnet
└── web/                Vite + React 18 + TS + Tailwind + wagmi/viem + framer-motion
    ├── src/config/     giwa.ts (모든 상수를 문서 URL로 추적) · abis/ · deployments.json
    ├── src/locales/    en/ + ko/ × 7개 네임스페이스
    ├── src/pages/      Landing · Worker · Employer · Evidence · Docs
    └── scripts/        sync-contracts.mjs · check-i18n.mjs
```

컨트랙트별 설계 근거, 스트림 수학과 검증된 불변식, 신뢰 모델, 위협 모델은
[`ARCHITECTURE.md`](./ARCHITECTURE.md)를 참고하세요(영문, 상단에 한국어 요약 포함).

---

## 빠른 시작

### 컨트랙트

```bash
cd contracts
make install          # forge install
make test             # 74개 테스트: 단위 + 퍼즈 + 불변식
make coverage         # 핵심 3개 컨트랙트 라인 95% 이상

# GIWA 세폴리아 배포 (데모 모드: 모의 Dojang으로 부스 지갑도 등록 가능)
cp .env.example .env  # 이후: cast wallet import deployer --interactive
make deploy-testnet
```

배포 명령은 GIWA 공식 Foundry 흐름을 그대로 따릅니다
([문서](https://docs.giwa.io/get-started/smart-contract/develop/foundry)).

### 웹

```bash
cd web
pnpm install
node scripts/sync-contracts.mjs   # Foundry 산출물에서 ABI+주소 복사 (손으로 복사하지 않음)
pnpm dev                          # http://localhost:5173
pnpm check:i18n                   # EN/KO 대칭성 + 하드코딩 문자열 검사 (CI 게이트)
pnpm build                        # tsc + vite, TS 오류 0
```

---

## 기술 스택

**컨트랙트** — Solidity ^0.8.28 · Foundry · OpenZeppelin v5 · Slither 설정 포함.

**프론트엔드** — Vite · React 18 · TypeScript(strict) · TailwindCSS v3(네오 단청 커스텀 테마) ·
framer-motion · wagmi + viem · TanStack Query · Zustand · react-router · react-i18next.

---

## 로드맵 (GASOK 단계별)

상태 표기는 문자 그대로입니다. **✅** 는 `main`에 반영되어 테스트 또는 실제 화면에서 동작하는
항목, **🚧** 는 컨트랙트나 컴포넌트는 있으나 사용자가 닿는 경로가 아직 없는 항목,
**⬜** 는 미착수 항목입니다.

### 1단계 — MVP(6–7월) ✅

- ✅ 네 개 컨트랙트를 GIWA Sepolia에 배포·소스 검증 완료. **실제** DojangScroll 및
  UPNameRegistry에 연결되어 있으며, 저장소에 모의(mock) 모드는 남아 있지 않습니다.
- ✅ 유닛 · 퍼즈 · 인베리언트 · 라이브 체인 포크 테스트 전부 통과, 핵심 컨트랙트 3종 라인
  커버리지 95% 이상. 발견된 취약점 4건은 익스플로잇 그대로 회귀 테스트로 보존
  ([`contracts/test/Exploits.t.sol`](./contracts/test/Exploits.t.sol)).
- ✅ 전체 데모 경로: 등록 → 볼트 개설 → 예치 → 스트리밍 → 출금 → 체불 → 증빙.
- ✅ 모든 페이지 한국어/영어 동시 지원, `pnpm check:i18n`을 CI 게이트로 운영.
- ✅ 잘못된 네트워크 감지 및 1회 프롬프트 체인 전환
  ([`web/src/hooks/useNetwork.ts`](./web/src/hooks/useNetwork.ts)). `useChainId()`는 지갑이 아니라
  *설정된* 체인을 반환하기 때문에 별도 모듈이 필요했습니다.

### 2단계 — 상용화(8–9월) 🚧

**아이덴티티 — `name.up.id`를 부가 기능이 아니라 기본 주소 체계로**

- ✅ 정방향 해석: 고용주가 볼트 개설 폼에 `worker.up.id`를 입력하면 트랜잭션 구성 전에
  `UpIdResolver.resolve`로 주소를 확인합니다.
- 🚧 역방향 해석. [`AddressChip`](./web/src/components/ui/AddressChip.tsx)은 이미 `upId` prop을
  받지만 이를 넘겨주는 곳이 없어, 노동자가 가장 확인해야 할 고용주 주소를 포함해 모든 주소가
  16진수로 표시됩니다. `UpIdResolver.reverse`를 감싸는 `useUpId(address)` 훅을 만들어
  `VaultCard`와 증빙 페이지에 연결해야 합니다.

**공공재로서의 평판**

- 🚧 공개 고용주 디렉터리(`/employers`). `employersPaged`와 `solvencyScore` 모두 ABI에 있으나
  [`useEmployer.ts`](./web/src/hooks/useEmployer.ts)는 *연결된* 고용주의 점수만 읽습니다. 노동자가
  입사 전에 고용주를 조회할 수 없다는 뜻이며, 임금 신뢰도 점수 구상의 나머지 절반이 여기에
  해당합니다.
- ⬜ 고용주별 공개 프로필: 점수, 예치 이력, 그리고 `ArrearsAttestor.recordsOfEmployer`(현재 앱에서
  미사용)를 통한 체불 기록.

**자금**

- 🚧 ERC-20 임금 볼트. `WageVault.openVault`는 이미 토큰 주소를 인자로 받고 컨트랙트는 SafeERC20 ·
  전송수수료 토큰 안전성을 갖췄지만, 폼은 네이티브 토큰과 `parseEther`를 고정으로 사용합니다. 토큰
  선택 UI, 소수점 자릿수를 고려한 파싱, `fund` 이전의 approve 단계가 필요합니다.
- ⬜ 원화 표시용 Upbit 오라클. 노동청 제출용 증빙 페이지를 포함해 앱의 모든 원화 금액이 현재
  [`web/src/lib/format.ts`](./web/src/lib/format.ts)의 `ETH_KRW_PLACEHOLDER` 상수에서 나옵니다.
  교체가 쉽도록 상수 하나로 격리해 두었습니다. 이 목록에서 정확성 리스크가 가장 큰 항목입니다 —
  증빙 페이지는 실제로 노동청에 제출되는 문서이므로 임시 환율이 실려서는 안 됩니다.

**체인 속도 주장의 실증**

- ⬜ Flashblocks 사전 확인. 현재 해당 엔드포인트는 *예비* 트랜스포트로만 설정되어 있습니다
  ([`web/src/config/wagmi.ts`](./web/src/config/wagmi.ts)). `fund`/`withdraw` 직후 pending 블록
  상태를 읽으면 `/docs`에 적힌 200ms 주장을 설명이 아니라 시연으로 만들 수 있습니다.

**보안 강화**

- ⬜ 컨트랙트 감사(GIWA 빌더 패키지).
- ⬜ `pnpm check:i18n`이 코드의 `t()`에서 참조하지만 로케일 파일에 없는 키까지 잡도록 확장.
  현재는 한/영 키 일치와 하드코딩된 JSX 문자열만 검사하므로, *양쪽 파일 모두에* 없는 키는 CI를
  통과한 뒤 화면에 키 문자열 그대로 노출됩니다.

### 3단계 — 확산(10–12월) ⬜

- GIWA 지갑 인앱 탭. `/worker`는 이미 모바일 우선 · injected 커넥터 우선 · 단일 주요 액션으로
  이를 염두에 두고 설계했으며, 남은 것은 지갑 측 임베딩 규격입니다.
- `PROTOCOL_OWNER`를 멀티시그로 설정한 메인넷 배포.
- 노동청 · 노동조합 파일럿: 현직 노무사의 증빙 페이지 검토, 기존 인쇄 경로에 더해 PDF 내보내기.
- 다수 노동자를 운영하는 고용주를 위한 볼트 일괄 개설.

**KPI 목표:** 월간 예치 볼트 · 활성 노동자 · 발행된 증빙 · 트랜잭션 규모.

---

## 라이선스

MIT © IMGEUM 기여자.
