/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/rural_rest_rwa.json`.
 */
export type RuralRestRwa = {
  "address": "BAJ2fSZGZMkt6dFs4Rn5u8CCSsaVtgKbr5Jfca659iZr",
  "metadata": {
    "name": "ruralRestRwa",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "activateProperty",
      "discriminator": [
        239,
        43,
        111,
        46,
        13,
        155,
        19,
        245
      ],
      "accounts": [
        {
          "name": "propertyToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  112,
                  101,
                  114,
                  116,
                  121
                ]
              },
              {
                "kind": "arg",
                "path": "listingId"
              }
            ]
          }
        },
        {
          "name": "operator",
          "docs": [
            "authority 또는 crank_authority"
          ],
          "signer": true
        },
        {
          "name": "rwaConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  119,
                  97,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "tokenMint",
          "writable": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "listingId",
          "type": "string"
        }
      ]
    },
    {
      "name": "cancelBookingEscrow",
      "discriminator": [
        195,
        194,
        241,
        73,
        174,
        82,
        49,
        229
      ],
      "accounts": [
        {
          "name": "caller",
          "signer": true
        },
        {
          "name": "bookingEscrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  111,
                  107,
                  105,
                  110,
                  103,
                  95,
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "arg",
                "path": "bookingId"
              }
            ]
          }
        },
        {
          "name": "escrowVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "bookingEscrow"
              },
              {
                "kind": "account",
                "path": "usdcTokenProgram"
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "guestUsdc",
          "writable": true
        },
        {
          "name": "rwaConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  119,
                  97,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "usdcTokenProgram"
        }
      ],
      "args": [
        {
          "name": "bookingId",
          "type": "string"
        }
      ]
    },
    {
      "name": "cancelBookingEscrowPartial",
      "discriminator": [
        17,
        129,
        43,
        56,
        131,
        146,
        77,
        226
      ],
      "accounts": [
        {
          "name": "caller",
          "signer": true
        },
        {
          "name": "bookingEscrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  111,
                  107,
                  105,
                  110,
                  103,
                  95,
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "arg",
                "path": "bookingId"
              }
            ]
          }
        },
        {
          "name": "escrowVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "bookingEscrow"
              },
              {
                "kind": "account",
                "path": "usdcTokenProgram"
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "guestUsdc",
          "writable": true
        },
        {
          "name": "hostUsdc",
          "writable": true
        },
        {
          "name": "rwaConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  119,
                  97,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "usdcTokenProgram"
        }
      ],
      "args": [
        {
          "name": "bookingId",
          "type": "string"
        },
        {
          "name": "guestBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "cancelPosition",
      "discriminator": [
        238,
        238,
        23,
        104,
        199,
        77,
        104,
        68
      ],
      "accounts": [
        {
          "name": "investor",
          "writable": true,
          "signer": true
        },
        {
          "name": "propertyToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  112,
                  101,
                  114,
                  116,
                  121
                ]
              },
              {
                "kind": "arg",
                "path": "listingId"
              }
            ]
          }
        },
        {
          "name": "investorPosition",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  118,
                  101,
                  115,
                  116,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "propertyToken"
              },
              {
                "kind": "account",
                "path": "investor"
              }
            ]
          }
        },
        {
          "name": "tokenMint",
          "writable": true
        },
        {
          "name": "investorRwaAccount",
          "writable": true
        },
        {
          "name": "fundingVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  117,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "listingId"
              }
            ]
          }
        },
        {
          "name": "investorUsdcAccount",
          "writable": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "usdcTokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "listingId",
          "type": "string"
        }
      ]
    },
    {
      "name": "claimDividend",
      "discriminator": [
        15,
        29,
        207,
        120,
        153,
        178,
        164,
        91
      ],
      "accounts": [
        {
          "name": "investor",
          "writable": true,
          "signer": true
        },
        {
          "name": "propertyToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  112,
                  101,
                  114,
                  116,
                  121
                ]
              },
              {
                "kind": "arg",
                "path": "listingId"
              }
            ]
          }
        },
        {
          "name": "investorPosition",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  118,
                  101,
                  115,
                  116,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "propertyToken"
              },
              {
                "kind": "account",
                "path": "investor"
              }
            ]
          }
        },
        {
          "name": "usdcVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "propertyToken"
              },
              {
                "kind": "account",
                "path": "usdcTokenProgram"
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "investorUsdcAccount",
          "writable": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "usdcTokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "listingId",
          "type": "string"
        }
      ]
    },
    {
      "name": "createBookingEscrow",
      "discriminator": [
        28,
        129,
        27,
        188,
        254,
        240,
        48,
        141
      ],
      "accounts": [
        {
          "name": "guest",
          "writable": true,
          "signer": true
        },
        {
          "name": "propertyToken",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  112,
                  101,
                  114,
                  116,
                  121
                ]
              },
              {
                "kind": "arg",
                "path": "listingId"
              }
            ]
          }
        },
        {
          "name": "bookingEscrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  111,
                  107,
                  105,
                  110,
                  103,
                  95,
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "arg",
                "path": "bookingId"
              }
            ]
          }
        },
        {
          "name": "escrowVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "bookingEscrow"
              },
              {
                "kind": "account",
                "path": "usdcTokenProgram"
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "guestUsdc",
          "writable": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "pythPriceFeed",
          "docs": [
            "Owner is verified to be the Pyth oracle program in the instruction body."
          ]
        },
        {
          "name": "usdcTokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "listingId",
          "type": "string"
        },
        {
          "name": "bookingId",
          "type": "string"
        },
        {
          "name": "amountKrw",
          "type": "u64"
        },
        {
          "name": "checkIn",
          "type": "i64"
        },
        {
          "name": "checkOut",
          "type": "i64"
        }
      ]
    },
    {
      "name": "distributeMonthlyRevenue",
      "discriminator": [
        124,
        95,
        191,
        40,
        199,
        229,
        147,
        92
      ],
      "accounts": [
        {
          "name": "propertyToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  112,
                  101,
                  114,
                  116,
                  121
                ]
              },
              {
                "kind": "arg",
                "path": "listingId"
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "propertyToken"
          ]
        },
        {
          "name": "authorityUsdcAccount",
          "writable": true
        },
        {
          "name": "usdcVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "propertyToken"
              },
              {
                "kind": "account",
                "path": "usdcTokenProgram"
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "usdcTokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "listingId",
          "type": "string"
        },
        {
          "name": "netRevenueUsdc",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializeConfig",
      "docs": [
        "RwaConfig 초기화 (1회성). authority 설정, crank은 비활성 상태로 시작."
      ],
      "discriminator": [
        208,
        127,
        21,
        1,
        194,
        190,
        196,
        70
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "rwaConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  119,
                  97,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initializeListingVault",
      "discriminator": [
        7,
        124,
        39,
        90,
        158,
        116,
        140,
        61
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "rwaConfig"
          ]
        },
        {
          "name": "rwaConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  119,
                  97,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "listingVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  105,
                  115,
                  116,
                  105,
                  110,
                  103,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "listingId"
              }
            ]
          }
        },
        {
          "name": "listingVaultAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "listingVault"
              },
              {
                "kind": "account",
                "path": "usdcTokenProgram"
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "usdcTokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "listingId",
          "type": "string"
        }
      ]
    },
    {
      "name": "initializeProperty",
      "discriminator": [
        94,
        188,
        21,
        36,
        186,
        50,
        195,
        141
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "propertyToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  112,
                  101,
                  114,
                  116,
                  121
                ]
              },
              {
                "kind": "arg",
                "path": "listingId"
              }
            ]
          }
        },
        {
          "name": "tokenMint",
          "writable": true,
          "signer": true
        },
        {
          "name": "fundingVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  117,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "listingId"
              }
            ]
          }
        },
        {
          "name": "usdcVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "propertyToken"
              },
              {
                "kind": "account",
                "path": "usdcTokenProgram"
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "usdcTokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "listingId",
          "type": "string"
        },
        {
          "name": "totalSupply",
          "type": "u64"
        },
        {
          "name": "valuationKrw",
          "type": "u64"
        },
        {
          "name": "pricePerTokenUsdc",
          "type": "u64"
        },
        {
          "name": "fundingDeadline",
          "type": "i64"
        },
        {
          "name": "minFundingBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "openPosition",
      "discriminator": [
        135,
        128,
        47,
        77,
        15,
        152,
        240,
        49
      ],
      "accounts": [
        {
          "name": "investor",
          "writable": true,
          "signer": true
        },
        {
          "name": "propertyToken",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  112,
                  101,
                  114,
                  116,
                  121
                ]
              },
              {
                "kind": "arg",
                "path": "listingId"
              }
            ]
          }
        },
        {
          "name": "investorPosition",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  118,
                  101,
                  115,
                  116,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "propertyToken"
              },
              {
                "kind": "account",
                "path": "investor"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "listingId",
          "type": "string"
        }
      ]
    },
    {
      "name": "purchaseTokens",
      "discriminator": [
        142,
        1,
        16,
        160,
        115,
        120,
        55,
        254
      ],
      "accounts": [
        {
          "name": "investor",
          "writable": true,
          "signer": true
        },
        {
          "name": "propertyToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  112,
                  101,
                  114,
                  116,
                  121
                ]
              },
              {
                "kind": "arg",
                "path": "listingId"
              }
            ]
          }
        },
        {
          "name": "tokenMint",
          "writable": true
        },
        {
          "name": "investorPosition",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  118,
                  101,
                  115,
                  116,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "propertyToken"
              },
              {
                "kind": "account",
                "path": "investor"
              }
            ]
          }
        },
        {
          "name": "investorUsdcAccount",
          "writable": true
        },
        {
          "name": "fundingVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  117,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "listingId"
              }
            ]
          }
        },
        {
          "name": "investorRwaAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "investor"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "usdcTokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "listingId",
          "type": "string"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "refund",
      "discriminator": [
        2,
        96,
        183,
        251,
        63,
        208,
        46,
        46
      ],
      "accounts": [
        {
          "name": "investor",
          "writable": true,
          "signer": true
        },
        {
          "name": "propertyToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  112,
                  101,
                  114,
                  116,
                  121
                ]
              },
              {
                "kind": "arg",
                "path": "listingId"
              }
            ]
          }
        },
        {
          "name": "investorPosition",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  118,
                  101,
                  115,
                  116,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "propertyToken"
              },
              {
                "kind": "account",
                "path": "investor"
              }
            ]
          }
        },
        {
          "name": "fundingVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  117,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "listingId"
              }
            ]
          }
        },
        {
          "name": "investorUsdcAccount",
          "writable": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "usdcTokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "listingId",
          "type": "string"
        }
      ]
    },
    {
      "name": "releaseBookingEscrow",
      "discriminator": [
        20,
        60,
        41,
        142,
        221,
        4,
        46,
        16
      ],
      "accounts": [
        {
          "name": "operator",
          "writable": true,
          "signer": true
        },
        {
          "name": "bookingEscrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  111,
                  107,
                  105,
                  110,
                  103,
                  95,
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "arg",
                "path": "bookingId"
              }
            ]
          }
        },
        {
          "name": "escrowVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "bookingEscrow"
              },
              {
                "kind": "account",
                "path": "usdcTokenProgram"
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "listingVault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  105,
                  115,
                  116,
                  105,
                  110,
                  103,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "booking_escrow.listing_id",
                "account": "bookingEscrow"
              }
            ]
          }
        },
        {
          "name": "listingVaultAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "listingVault"
              },
              {
                "kind": "account",
                "path": "usdcTokenProgram"
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "treasuryUsdc",
          "writable": true
        },
        {
          "name": "rwaConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  119,
                  97,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "usdcTokenProgram"
        }
      ],
      "args": [
        {
          "name": "bookingId",
          "type": "string"
        }
      ]
    },
    {
      "name": "releaseFunds",
      "discriminator": [
        225,
        88,
        91,
        108,
        126,
        52,
        2,
        26
      ],
      "accounts": [
        {
          "name": "propertyToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  112,
                  101,
                  114,
                  116,
                  121
                ]
              },
              {
                "kind": "arg",
                "path": "listingId"
              }
            ]
          }
        },
        {
          "name": "operator",
          "docs": [
            "authority 또는 crank_authority"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "rwaConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  119,
                  97,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "fundingVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  117,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "listingId"
              }
            ]
          }
        },
        {
          "name": "authorityUsdcAccount",
          "docs": [
            "USDC 수신: 항상 property authority의 계좌 (signer와 무관)"
          ],
          "writable": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "usdcTokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "listingId",
          "type": "string"
        }
      ]
    },
    {
      "name": "setCrankAuthority",
      "docs": [
        "crank_authority 설정/교체. authority만 호출 가능."
      ],
      "discriminator": [
        158,
        239,
        112,
        185,
        20,
        25,
        150,
        203
      ],
      "accounts": [
        {
          "name": "rwaConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  119,
                  97,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "rwaConfig"
          ]
        }
      ],
      "args": [
        {
          "name": "newCrank",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "setTreasury",
      "docs": [
        "treasury 설정/교체. authority만 호출 가능."
      ],
      "discriminator": [
        57,
        97,
        196,
        95,
        195,
        206,
        106,
        136
      ],
      "accounts": [
        {
          "name": "rwaConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  119,
                  97,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "rwaConfig"
          ]
        }
      ],
      "args": [
        {
          "name": "newTreasury",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "settleListingMonthly",
      "discriminator": [
        203,
        187,
        163,
        69,
        54,
        142,
        10,
        212
      ],
      "accounts": [
        {
          "name": "operator",
          "writable": true,
          "signer": true
        },
        {
          "name": "rwaConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  119,
                  97,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "listingVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  105,
                  115,
                  116,
                  105,
                  110,
                  103,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "listingId"
              }
            ]
          }
        },
        {
          "name": "listingVaultAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "listingVault"
              },
              {
                "kind": "account",
                "path": "usdcTokenProgram"
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "propertyToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  112,
                  101,
                  114,
                  116,
                  121
                ]
              },
              {
                "kind": "arg",
                "path": "listingId"
              }
            ]
          }
        },
        {
          "name": "govUsdc",
          "writable": true
        },
        {
          "name": "operatorUsdc",
          "writable": true
        },
        {
          "name": "usdcVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "propertyToken"
              },
              {
                "kind": "account",
                "path": "usdcTokenProgram"
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "authorityUsdc",
          "writable": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "usdcTokenProgram"
        }
      ],
      "args": [
        {
          "name": "listingId",
          "type": "string"
        },
        {
          "name": "yearMonth",
          "type": "u32"
        },
        {
          "name": "operatingCostUsdc",
          "type": "u64"
        },
        {
          "name": "govBps",
          "type": "u16"
        },
        {
          "name": "operatorBps",
          "type": "u16"
        },
        {
          "name": "investorBps",
          "type": "u16"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "bookingEscrow",
      "discriminator": [
        229,
        229,
        38,
        29,
        92,
        48,
        93,
        60
      ]
    },
    {
      "name": "investorPosition",
      "discriminator": [
        145,
        143,
        236,
        150,
        229,
        40,
        195,
        88
      ]
    },
    {
      "name": "listingVault",
      "discriminator": [
        23,
        14,
        106,
        31,
        168,
        17,
        92,
        121
      ]
    },
    {
      "name": "propertyToken",
      "discriminator": [
        249,
        91,
        54,
        42,
        4,
        52,
        232,
        170
      ]
    },
    {
      "name": "rwaConfig",
      "discriminator": [
        103,
        48,
        215,
        148,
        74,
        15,
        31,
        129
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "insufficientTokenSupply",
      "msg": "Insufficient token supply remaining."
    },
    {
      "code": 6001,
      "name": "exceedsInvestorCap",
      "msg": "Exceeds individual investor cap (30%)."
    },
    {
      "code": 6002,
      "name": "mathOverflow",
      "msg": "Math overflow."
    },
    {
      "code": 6003,
      "name": "noPendingDividend",
      "msg": "No pending dividend to claim."
    },
    {
      "code": 6004,
      "name": "unauthorized",
      "msg": "Unauthorized."
    },
    {
      "code": 6005,
      "name": "invalidStatus",
      "msg": "Invalid property status for this operation."
    },
    {
      "code": 6006,
      "name": "fundingExpired",
      "msg": "Funding deadline has passed."
    },
    {
      "code": 6007,
      "name": "refundNotAvailable",
      "msg": "Refund conditions not met: goal was reached or deadline has not passed."
    },
    {
      "code": 6008,
      "name": "alreadyRefunded",
      "msg": "This position has already been refunded."
    },
    {
      "code": 6009,
      "name": "invalidDeadline",
      "msg": "Deadline must be in the future."
    },
    {
      "code": 6010,
      "name": "releaseNotAvailable",
      "msg": "Release conditions not met: not sold out and deadline not passed or goal not reached."
    },
    {
      "code": 6011,
      "name": "authorityCannotInvest",
      "msg": "The property authority cannot invest in their own property."
    },
    {
      "code": 6012,
      "name": "zeroAmount",
      "msg": "Amount must be greater than zero."
    },
    {
      "code": 6013,
      "name": "zeroRevenue",
      "msg": "Revenue must be greater than zero."
    },
    {
      "code": 6014,
      "name": "fundsAlreadyReleased",
      "msg": "Funds have already been released."
    },
    {
      "code": 6015,
      "name": "invalidFundingBps",
      "msg": "Invalid funding bps: must be between 1 and 10000."
    },
    {
      "code": 6016,
      "name": "invalidPrice",
      "msg": "Invalid price: must be greater than zero."
    },
    {
      "code": 6017,
      "name": "deadlineTooFar",
      "msg": "Deadline too far in the future (max 365 days)."
    },
    {
      "code": 6018,
      "name": "fundingStillOpen",
      "msg": "Funding period is still open. Wait until deadline passes."
    },
    {
      "code": 6019,
      "name": "invalidCrankAuthority",
      "msg": "Invalid crank authority."
    },
    {
      "code": 6020,
      "name": "stalePythPrice",
      "msg": "Pyth price feed is stale (older than 60 seconds)."
    },
    {
      "code": 6021,
      "name": "pythConfidenceTooWide",
      "msg": "Pyth price confidence interval is too wide (>= 2% of price)."
    },
    {
      "code": 6022,
      "name": "invalidPythPrice",
      "msg": "Pyth price is non-positive or failed to load."
    },
    {
      "code": 6023,
      "name": "bookingNotPending",
      "msg": "Booking escrow is not in Pending status."
    },
    {
      "code": 6024,
      "name": "checkInNotPassed",
      "msg": "Check-in time has not passed yet; cannot release escrow."
    },
    {
      "code": 6025,
      "name": "invalidRefundBps",
      "msg": "guest_bps must be between 1 and 9999."
    },
    {
      "code": 6026,
      "name": "alreadySettled",
      "msg": "Listing already settled for this month."
    },
    {
      "code": 6027,
      "name": "invalidBpsSum",
      "msg": "bps split must sum to 10000."
    },
    {
      "code": 6028,
      "name": "insufficientVaultBalance",
      "msg": "Operating cost exceeds vault balance."
    },
    {
      "code": 6029,
      "name": "invalidYearMonth",
      "msg": "year_month format invalid (expected YYYYMM)."
    }
  ],
  "types": [
    {
      "name": "bookingEscrow",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "guest",
            "type": "pubkey"
          },
          {
            "name": "host",
            "type": "pubkey"
          },
          {
            "name": "listingId",
            "type": "string"
          },
          {
            "name": "bookingId",
            "type": "string"
          },
          {
            "name": "usdcMint",
            "type": "pubkey"
          },
          {
            "name": "amountUsdc",
            "type": "u64"
          },
          {
            "name": "checkIn",
            "type": "i64"
          },
          {
            "name": "checkOut",
            "type": "i64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "escrowStatus"
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "escrowStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "pending"
          },
          {
            "name": "released"
          },
          {
            "name": "refunded"
          }
        ]
      }
    },
    {
      "name": "investorPosition",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "rewardDebt",
            "type": "u128"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "listingVault",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "listingId",
            "type": "string"
          },
          {
            "name": "lastSettledYearMonth",
            "type": "u32"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "propertyStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "funding"
          },
          {
            "name": "funded"
          },
          {
            "name": "active"
          },
          {
            "name": "failed"
          }
        ]
      }
    },
    {
      "name": "propertyToken",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "listingId",
            "type": "string"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "usdcMint",
            "type": "pubkey"
          },
          {
            "name": "totalSupply",
            "type": "u64"
          },
          {
            "name": "tokensSold",
            "type": "u64"
          },
          {
            "name": "valuationKrw",
            "type": "u64"
          },
          {
            "name": "pricePerTokenUsdc",
            "type": "u64"
          },
          {
            "name": "accDividendPerShare",
            "type": "u128"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "propertyStatus"
              }
            }
          },
          {
            "name": "fundingDeadline",
            "type": "i64"
          },
          {
            "name": "minFundingBps",
            "type": "u16"
          },
          {
            "name": "fundsReleased",
            "type": "bool"
          },
          {
            "name": "fundingVaultBump",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "rwaConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "crankAuthority",
            "type": "pubkey"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
