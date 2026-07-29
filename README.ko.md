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

## GIWA 심사 기준 매핑

| 기준                 | IMGEUM의 답                                                                                                                                                                                                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **왜 하필 GIWA인가** | 이 제품은 빠른 체인 위에서만 읽힙니다. GIWA의 **1초 블록** + **Flashblocks**(200ms 사전 확인)가 초당 임금 스트림을 겉치레가 아닌 실제로 만듭니다. **Dojang 검증 주소**는 노동자가 신뢰할 수 있는 사업주 신원을, **up.id**는 사람이 읽을 수 있는 주소를 제공합니다. 12초 L1에서는 성립하지 않습니다. |
| **독창성**           | 또 하나의 DeFi 프리미티브가 아닙니다. 구체적이고 문서화된 한국 사회 문제를 겨냥한 임금체불 _증빙_ 프로토콜이며, 증빙 계층은 사업주 채택이 0이어도 가치를 냅니다.                                                                                                                                    |
| **실현 가능성**      | 컨트랙트 완성, 127개 테스트 통과(단위+퍼즈+불변식+라이브 체인 포크, 라인 커버리지 95% 이상), 한 줄 명령 테스트넷 배포·소스 검증 완료, TypeScript 오류 0의 완전 이중 언어 프론트엔드.                                                                                                                                                 |
| **시장 수요**        | 연 1조 7,800억 원 체불, 연 27만 5천 명 이상(고용노동부 2023). 노동청, 노조, 이주노동자 지원단체가 구체적 초기 사용자입니다.                                                                                                                                                                         |
| **GIWA 지갑 임베드** | `/worker` 화면은 지갑 인앱 탭으로 설계되었습니다: 모바일 우선, injected 커넥터 우선, 단일 주요 동작(출금), 스트림 전면 배치.                                                                                                                                                                        |

---

## 모노레포 구조

```
imgeum/
├── contracts/          Foundry 프로젝트 (Solidity ^0.8.28, OpenZeppelin v5)
│   ├── src/            EmployerRegistry · WageVault · ArrearsAttestor · UpIdResolver · GiwaConstants
│   │   └── interfaces/ IDojangVerifier · IUpIdResolver · IUpNameRegistry · I{EmployerRegistry,WageVault}
│   ├── test/           단위 · 퍼즈 · 불변식 · 포크(라이브 GIWA 세폴리아) 스위트
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
make test             # 127개 테스트: 단위 + 퍼즈 + 불변식 + 라이브 체인 포크
make test-fork        # 포크 스위트만, 실제 GIWA 세폴리아 상태 대상
make coverage         # 핵심 3개 컨트랙트 라인 95% 이상

# GIWA 세폴리아 배포. 신원은 항상 GIWA의 실제 DojangScroll + UPNameRegistry를 사용합니다 —
# 모의(mock) 모드는 없으며, 대상 체인에 둘 중 하나라도 코드가 없으면 스크립트가 revert 합니다.
cp .env.example .env      # 이후: cast wallet import deployer --interactive
make deploy-testnet-dry   # 먼저 실제 체인 상태로 시뮬레이션
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

## 라이브 배포 — GIWA 세폴리아 (체인 ID 91342)

네 개 컨트랙트 모두 배포 및 **소스 검증 완료**. GIWA의 **실제** 신원 인프라에 연결되어 있으며,
모의(mock) 모드는 존재하지 않습니다. 등록은 라이브 DojangScroll로 게이트되며, 지갑은
[GIWA 플레이그라운드](https://sepolia-playground.giwa.io/)에서 "Dojang 발급"으로 검증 주소를
직접 발급받습니다.

| 컨트랙트 | 역할 | 주소 |
| --- | --- | --- |
| `EmployerRegistry` | 사업주 신원(Dojang 게이트) + 공개 지급 이력 | [`0x0B804D278702Cd51A4Ed6eab6777d3d9574EF735`](https://sepolia-explorer.giwa.io/address/0x0B804D278702Cd51A4Ed6eab6777d3d9574EF735) |
| `WageVault` | 노동자별 스트리밍 임금 에스크로 (ETH + ERC-20) | [`0x73627942b45c269D670d3C6233A1a0e32584dC0f`](https://sepolia-explorer.giwa.io/address/0x73627942b45c269D670d3C6233A1a0e32584dC0f) |
| `ArrearsAttestor` | 무허가 체불 증빙, 소울바운드 ERC-721 | [`0x9547C72811d3506498031Fc63E1608098E533f4e`](https://sepolia-explorer.giwa.io/address/0x9547C72811d3506498031Fc63E1608098E533f4e) |
| `UpIdResolver` | `name.up.id` 정방향·역방향 해석 | [`0x11478539941f278Fe6e91A217D607Ec64c8D0be9`](https://sepolia-explorer.giwa.io/address/0x11478539941f278Fe6e91A217D607Ec64c8D0be9) |

우리 컨트랙트가 아니라 **GIWA 자체 컨트랙트**를 읽습니다:

| GIWA 컨트랙트 | 주소 | 역할 |
| --- | --- | --- |
| `DojangScroll` | `0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9` | 사업주 신원 게이트 |
| `UPNameRegistry` | `0x091D00004f21eb2Fc30964A8a4995692d9b49628` | `name.up.id` 해석 |
| Attester | `TESTNET_FAUCET` | 어떤 검증 주소 어테스테이션을 인정할지 |

---

## 보안

모의 모드를 걷어내고 실제 체인에 올리는 과정에서 취약점 4건을 발견·수정했습니다. 각 항목은
동작하는 익스플로잇 그대로 [`contracts/test/Exploits.t.sol`](./contracts/test/Exploits.t.sol)에
회귀 테스트로 보존되어 있습니다.

| # | 문제 | 영향 | 수정 |
| --- | --- | --- | --- |
| 1 | 라이브 DojangScroll에서 만료·취소된 어테스테이션에 대해 `getVerifiedAddressAttestationUid`가 **revert** (`isVerified`는 `false` 반환) | 검증이 만료된 사업주가 관련된 모든 체불 기록의 `verifyRecord` — 즉 노동청 제출용 증빙 페이지 — 를 백지로 만듦 | 보호된 읽기(`ArrearsAttestor._liveDojangUid`). 동결된 스냅샷이 신원보다 오래 살아남음 |
| 2 | 최소 지급 주기 부재 | 1 wei 볼트와 통제 지갑으로 만점(1000) 지급 신뢰도를 **6초** 만에 조작 가능 | `WageVault.MIN_PERIOD`. `block.timestamp` 기준 측정이라 백데이팅으로 시간을 되살 수 없음 |
| 3 | `setRecorder(attestor, false)` | 소유자 트랜잭션 한 번으로 체불 증빙 발행을 영구 무력화, 쓰기 1회 제한인 `setAttestor` 보장을 우회 | recorder 권한 부여는 철회 불가. `attestArrears`도 이력을 best-effort로 기록 |
| 4 | `_safeMint` + 일시정지 가능한 `fund` | 스마트 계정 노동자가 증빙을 **영영 수령 불가**. 또한 일시정지로 정상 지급 중인 사업주에게 체불을 조작 가능 | `_mint`로 변경(어차피 소울바운드). `fund`는 더 이상 일시정지 대상이 아님 |

`make test`는 127개 테스트를 실행합니다 — 단위·퍼즈·불변식, 그리고 실제 GIWA 세폴리아 상태를
대상으로 하는 포크 스위트.

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
- ✅ 역방향 해석([`useUpId`](./web/src/hooks/useUpId.ts)). 사람을 알아봐야 하는 자리 — 볼트 카드,
  증빙 페이지, 지갑 버튼 — 에서는 주소가 `name.up.id`로 표시되고, 16진수 주소는 title과 복사에
  그대로 남습니다. `reverse`는 만료된 이름에 대해 `""`를 돌려주므로 화면에 뜬 이름은 모두 유효한
  신원이며, 조회는 캐시·중복 제거되어 볼트 여덟 개 목록도 서로 다른 주소 수만큼만 호출합니다.

**공공재로서의 평판**

- ✅ 공개 고용주 디렉터리([`/employers`](./web/src/pages/Employers.tsx)). `employersPaged`로
  페이지 단위 조회하며 지갑 연결 없이 열람할 수 있습니다 — 입사를 고민하는 사람이야말로 지갑을
  들고 있을 가능성이 가장 낮기 때문입니다. 신뢰도 순으로 정렬하되, 미평가 사업주는 0점 취급하지
  않고 평가된 사업주 뒤에 배치합니다.
- ✅ 고용주별 공개 프로필([`/employers/:address`](./web/src/pages/EmployerProfile.tsx)): 신원,
  실시간 Dojang 상태, 점수, 예치 이력, 그리고 `recordsOfEmployer`로 읽은 모든 체불 기록이 각각의
  증빙 페이지로 연결됩니다.
- ✅ 사업주 콘솔의 체불 기록. 누군가 증명을 발행하는 순간 기록은 공개되고 영구히 남지만, 정작
  해당 기업은 그 사실을 가장 늦게 알게 되는 구조였습니다. 미지급액을 정산할 수 있는 유일한
  당사자에게 먼저 보이도록 했습니다.

**자금**

- ✅ ERC-20 임금 볼트. 볼트 개설 폼은 `symbol`과 `decimals`에 응답하는 모든 ERC-20을 받고, 금액을
  18자리 고정이 아닌 해당 토큰의 소수점 자릿수로 파싱하며, 예치는 토큰이 요구하는 approve 단계를
  거칩니다. 두 트랜잭션을 그대로 두 단계로 보여주므로, 예치 서명을 거절해도 승인 한도는 남고 화면에는
  명확한 예치 버튼이 남습니다.
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
