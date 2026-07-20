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
│   │   └── mocks/      MockDojangScroll · MockUpIdResolver (데모 교체 지점)
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

- **1단계 — MVP(6–7월):** ✅ 컨트랙트 + 테스트 + 이중 언어 앱; 테스트넷 배포; 전체 데모 경로.
- **2단계 — 상용화(8–9월):** 모의 Dojang → 실제 DojangScroll 교체; up.id 클라이언트 ENS 해석;
  Upbit 오라클로 실시간 원화 표시; 컨트랙트 감사; GIWA 지갑 탭 연동.
- **KPI 목표:** 월간 예치 볼트 · 활성 노동자 · 발행된 증빙 · 트랜잭션 규모.

---

## 라이선스

MIT © IMGEUM 기여자.
