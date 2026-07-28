/**
 * The slice of ERC-20 this app touches: metadata for display, and the allowance pair that
 * funding a token vault requires.
 *
 * Hand-written rather than synced, because no ERC-20 is part of the IMGEUM deployment — the
 * wage token is whatever the employer names, and its ABI is the standard, not ours. Kept to
 * the four functions actually called so nothing here implies IMGEUM can do more to a token
 * than read it and spend what it was approved.
 */
export const ERC20_ABI = [
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{type: 'string'}],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{type: 'uint8'}],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{name: 'account', type: 'address'}],
    outputs: [{type: 'uint256'}],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      {name: 'owner', type: 'address'},
      {name: 'spender', type: 'address'},
    ],
    outputs: [{type: 'uint256'}],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      {name: 'spender', type: 'address'},
      {name: 'amount', type: 'uint256'},
    ],
    outputs: [{type: 'bool'}],
  },
] as const;
