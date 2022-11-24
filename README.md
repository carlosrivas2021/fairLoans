# Fair Loans

## Planteamiento

La idea de este proyecto es poder dar la ventaja de poder recibir préstamos, en un proceso transparente con un margen del 80% de colateral, teniendo como alcance el préstamo inicial, la idea es aprovechar los tiempos de pago para disminuir el margen de fee por cada proceso.

Para que estos préstamos tengan sentido el colateral debe ser tokens no no estables o ether. Y como préstamo se dan stablecoins.

## Contracts

Aquí están definidos las distintas address en testnet o mainnet

```
IERC20 public constant dai =
        // IERC20(0xdc31Ee1784292379Fbb2964b3B9C4124D8F89C60); // Goerli
        IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F); // Mainnet
IERC20 private constant weth =
        // IERC20(0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6); // Goerli
        IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2); // Mainnet
AggregatorV3Interface internal constant priceFeed =
        // AggregatorV3Interface(0xA39434A63A52E749F02807ae27335515BA4b07F7); // Goerli
        AggregatorV3Interface(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419); // Mainnet
ISwapRouter public constant uniswapRouter =
        ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
```

MyFairLoans.sol: Este contrato esta definido todo el protocolo de lending.
Math.sol: Este contrato tiene algunos cálculos matemático.
CalculateFee.sol: Este contrato es el responsable de calcular los fees.

El uniswap usado es la v3.

## Deploy

```bash
hh run scripts/deploy.ts
```

## Test
Los test estan desarrollados con dos visiones, la vision mockeada y la vision forkeada de la mainnet

```bash
hh test test/MyFairLoans.ts
hh node
hh test test/MyFairLoans-mainnet.ts --network localhost
```

## Todo
Estas áreas de mejora están planificadas como mejoras que se fueron viendo en el desarrollo del proyecto, pero  cuando se fueron implementando procesos se tomó la decisión de disminuir la carga.

- Usar el colateral para invertir en avee
- Usar los dai en avee para invertir mientras no se presten.
- Agregar más alternativas de colateral y préstamos.
- Que esa flexibilidad de monedas no sea a través de que sea modificable el contrato.
