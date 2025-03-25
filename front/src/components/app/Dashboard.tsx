'use client'

import { IconIds, OrderbookAxisScale } from '@/enums'
import numeral from 'numeral'
import { useAppStore } from '@/stores/app.store'
import { ReactNode, useRef, useState } from 'react'
import IconWrapper from '../common/IconWrapper'
import TokenImage from './TokenImage'
import ChainImage from './ChainImage'
import DepthChart from '../charts/DepthChart'
import { AmmAsOrderbook } from '@/interfaces'
import SelectTokenModal from './SelectTokenModal'
import { useModal } from 'connectkit'
import { useAccount } from 'wagmi'
import { useClickOutside } from '@/hooks/useClickOutside'
import { cn } from '@/utils'

const OrderbookKeyMetric = (props: { title: string; content: ReactNode }) => (
    <OrderbookComponentLayout title={<p className="text-milk-600 text-xs">{props.title}</p>} content={props.content} />
)
const OrderbookComponentLayout = (props: { title: ReactNode; content: ReactNode }) => (
    <div className="flex flex-col w-full border rounded-xl px-4 py-3 border-milk-100 gap-1 bg-gray-600/5">
        {props.title}
        {props.content}
    </div>
)

const orderbookHardcoded: AmmAsOrderbook = {
    token0: {
        address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        decimals: 18,
        symbol: 'WETH',
        gas: '29962',
    },
    token1: {
        address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        decimals: 6,
        symbol: 'USDC',
        gas: '40652',
    },
    prices0to1: [1955.8321968421496, 1960.247120115551, 1955.5724671918051, 1959.4647247346966, 1955.0707460095962],
    prices1to0: [0.0005112913068997338, 0.0005101397623484598, 0.0005113592141312955, 0.0005103434562392522, 0.0005114904419909374],
    trades0to1: [
        {
            amount: 0.008503765796105673,
            output: 16.629752,
            distribution: [18.02, 20.02, 0.0, 41.93, 20.02],
            gas_costs: [120000, 132000, 0, 132000, 120000],
            gas_costs_usd: [0.1487340476836776, 0.16360745245204533, 0.0, 0.16360745245204533, 0.1487340476836776],
            gas_costs_output: [3.8798800839111255e-8, 4.267868092302238e-8, 0.0, 4.267868092302238e-8, 3.8798800839111255e-8],
            ratio: 1955.57502390478,
        },
        {
            amount: 0.28320909132307215,
            output: 553.8106,
            distribution: [20.02, 39.94, 20.02, 20.02, 0.0],
            gas_costs: [120000, 132000, 132000, 132000, 0],
            gas_costs_usd: [0.1487340476836776, 0.16360745245204533, 0.16360745245204533, 0.16360745245204533, 0.0],
            gas_costs_output: [3.8798800839111255e-8, 4.267868092302238e-8, 4.267868092302238e-8, 4.267868092302238e-8, 0.0],
            ratio: 1955.4831287821823,
        },
        {
            amount: 0.5357036764944785,
            output: 1047.555863,
            distribution: [20.02, 39.94, 20.02, 20.02, 0.0],
            gas_costs: [120000, 132000, 132000, 132000, 0],
            gas_costs_usd: [0.1487340476836776, 0.16360745245204533, 0.16360745245204533, 0.16360745245204533, 0.0],
            gas_costs_output: [3.8798800839111255e-8, 4.267868092302238e-8, 4.267868092302238e-8, 4.267868092302238e-8, 0.0],
            ratio: 1955.476336946135,
        },
        {
            amount: 1.0133093809560265,
            output: 1981.489495,
            distribution: [20.02, 39.94, 20.02, 20.02, 0.0],
            gas_costs: [120000, 132000, 132000, 132000, 0],
            gas_costs_usd: [0.1487340476836776, 0.16360745245204533, 0.16360745245204533, 0.16360745245204533, 0.0],
            gas_costs_output: [3.8798800839111255e-8, 4.267868092302238e-8, 4.267868092302238e-8, 4.267868092302238e-8, 0.0],
            ratio: 1955.4634865124067,
        },
        {
            amount: 1.3936405729429646,
            output: 2725.198997,
            distribution: [20.02, 39.94, 20.02, 20.02, 0.0],
            gas_costs: [120000, 132000, 132000, 132000, 0],
            gas_costs_usd: [0.1487340476836776, 0.16360745245204533, 0.16360745245204533, 0.16360745245204533, 0.0],
            gas_costs_output: [3.8798800839111255e-8, 4.267868092302238e-8, 4.267868092302238e-8, 4.267868092302238e-8, 0.0],
            ratio: 1955.4532566780615,
        },
        {
            amount: 1.9167236414216922,
            output: 3748.036515,
            distribution: [20.02, 39.94, 20.02, 20.02, 0.0],
            gas_costs: [120000, 132000, 132000, 132000, 0],
            gas_costs_usd: [0.1487340476836776, 0.16360745245204533, 0.16360745245204533, 0.16360745245204533, 0.0],
            gas_costs_output: [3.8798800839111255e-8, 4.267868092302238e-8, 4.267868092302238e-8, 4.267868092302238e-8, 0.0],
            ratio: 1955.4391848685957,
        },
        {
            amount: 2.636138462750672,
            output: 5154.757431,
            distribution: [20.02, 39.94, 20.02, 20.02, 0.0],
            gas_costs: [120000, 132000, 132000, 132000, 0],
            gas_costs_usd: [0.1487340476836776, 0.16360745245204533, 0.16360745245204533, 0.16360745245204533, 0.0],
            gas_costs_output: [3.8798800839111255e-8, 4.267868092302238e-8, 4.267868092302238e-8, 4.267868092302238e-8, 0.0],
            ratio: 1955.4198323942674,
        },
        {
            amount: 3.625575354013486,
            output: 7089.425457,
            distribution: [20.02, 39.94, 20.02, 20.02, 0.0],
            gas_costs: [120000, 132000, 132000, 132000, 0],
            gas_costs_usd: [0.1487340476836776, 0.16360745245204533, 0.16360745245204533, 0.16360745245204533, 0.0],
            gas_costs_output: [3.8798800839111255e-8, 4.267868092302238e-8, 4.267868092302238e-8, 4.267868092302238e-8, 0.0],
            ratio: 1955.3932175625741,
        },
        {
            amount: 4.986383239488154,
            output: 9750.157456,
            distribution: [20.02, 39.94, 20.02, 20.02, 0.0],
            gas_costs: [120000, 132000, 132000, 132000, 0],
            gas_costs_usd: [0.1487340476836776, 0.16360745245204533, 0.16360745245204533, 0.16360745245204533, 0.0],
            gas_costs_output: [3.8798800839111255e-8, 4.267868092302238e-8, 4.267868092302238e-8, 4.267868092302238e-8, 0.0],
            ratio: 1955.3566157503856,
        },
        {
            amount: 6.857950913507864,
            output: 13413.179091,
            distribution: [14.6, 45.34, 20.03, 20.03, 0.0],
            gas_costs: [120000, 132000, 132000, 132000, 0],
            gas_costs_usd: [0.1487340476836776, 0.16360745245204533, 0.16360745245204533, 0.16360745245204533, 0.0],
            gas_costs_output: [3.8798800839111255e-8, 4.267868092302238e-8, 4.267868092302238e-8, 4.267868092302238e-8, 0.0],
            ratio: 1955.8581360768471,
        },
        {
            amount: 9.431984761947637,
            output: 18449.808887,
            distribution: [11.83, 48.1, 20.03, 20.03, 0.0],
            gas_costs: [120000, 132000, 132000, 132000, 0],
            gas_costs_usd: [0.1487340476836776, 0.16360745245204533, 0.16360745245204533, 0.16360745245204533, 0.0],
            gas_costs_output: [3.8798800839111255e-8, 4.267868092302238e-8, 4.267868092302238e-8, 4.267868092302238e-8, 0.0],
            ratio: 1956.0897682356142,
        },
        {
            amount: 12.972145422386506,
            output: 25376.888324,
            distribution: [9.59, 50.33, 20.04, 20.04, 0.0],
            gas_costs: [120000, 132000, 132000, 132000, 0],
            gas_costs_usd: [0.1487340476836776, 0.16360745245204533, 0.16360745245204533, 0.16360745245204533, 0.0],
            gas_costs_output: [3.8798800839111255e-8, 4.267868092302238e-8, 4.267868092302238e-8, 4.267868092302238e-8, 0.0],
            ratio: 1956.2599321625069,
        },
        {
            amount: 17.84105478397691,
            output: 34903.76631,
            distribution: [7.77, 52.12, 20.05, 20.05, 0.0],
            gas_costs: [120000, 132000, 132000, 132000, 0],
            gas_costs_usd: [0.1487340476836776, 0.16360745245204533, 0.16360745245204533, 0.16360745245204533, 0.0],
            gas_costs_output: [3.8798800839111255e-8, 4.267868092302238e-8, 4.267868092302238e-8, 4.267868092302238e-8, 0.0],
            ratio: 1956.3734730161325,
        },
        {
            amount: 24.537439678679355,
            output: 48005.826213,
            distribution: [6.3, 53.57, 20.07, 20.07, 0.0],
            gas_costs: [120000, 132000, 132000, 132000, 0],
            gas_costs_usd: [0.1487340476836776, 0.16360745245204533, 0.16360745245204533, 0.16360745245204533, 0.0],
            gas_costs_output: [3.8798800839111255e-8, 4.267868092302238e-8, 4.267868092302238e-8, 4.267868092302238e-8, 0.0],
            ratio: 1956.4317565989734,
        },
        {
            amount: 33.74721692607333,
            output: 66022.170398,
            distribution: [5.67, 54.18, 20.07, 20.07, 0.0],
            gas_costs: [120000, 132000, 132000, 134000, 0],
            gas_costs_usd: [0.1487340476836776, 0.16360745245204533, 0.16360745245204533, 0.16608635324677332, 0.0],
            gas_costs_output: [3.8798800839111255e-8, 4.267868092302238e-8, 4.267868092302238e-8, 4.3325327603674235e-8, 0.0],
            ratio: 1956.3737816551866,
        },
        {
            amount: 46.41375241953312,
            output: 90794.865141,
            distribution: [5.67, 54.18, 20.07, 20.07, 0.0],
            gas_costs: [120000, 132000, 132000, 134000, 0],
            gas_costs_usd: [0.1487340476836776, 0.16360745245204533, 0.16360745245204533, 0.16608635324677332, 0.0],
            gas_costs_output: [3.8798800839111255e-8, 4.267868092302238e-8, 4.267868092302238e-8, 4.3325327603674235e-8, 0.0],
            ratio: 1956.2060899602939,
        },
        {
            amount: 63.834490956122025,
            output: 124862.825505,
            distribution: [5.1, 54.73, 20.08, 20.08, 0.0],
            gas_costs: [120000, 132000, 132000, 134000, 0],
            gas_costs_usd: [0.1487340476836776, 0.16360745245204533, 0.16360745245204533, 0.16608635324677332, 0.0],
            gas_costs_output: [3.8798800839111255e-8, 4.267868092302238e-8, 4.267868092302238e-8, 4.3325327603674235e-8, 0.0],
            ratio: 1956.0401224289087,
        },
        {
            amount: 87.79385469191968,
            output: 171700.898268,
            distribution: [5.1, 54.73, 20.08, 20.08, 0.0],
            gas_costs: [120000, 132000, 132000, 134000, 0],
            gas_costs_usd: [0.1487340476836776, 0.16360745245204533, 0.16360745245204533, 0.16608635324677332, 0.0],
            gas_costs_output: [3.8798800839111255e-8, 4.267868092302238e-8, 4.267868092302238e-8, 4.3325327603674235e-8, 0.0],
            ratio: 1955.7279819928322,
        },
        {
            amount: 120.7460231329172,
            output: 236137.326354,
            distribution: [0.0, 57.88, 21.06, 21.06, 0.0],
            gas_costs: [0, 132000, 132000, 136000, 0],
            gas_costs_usd: [0.0, 0.16360745245204533, 0.16360745245204533, 0.16856525404150127, 0.0],
            gas_costs_output: [0.0, 4.267868092302238e-8, 4.267868092302238e-8, 4.3971974284326094e-8, 0.0],
            ratio: 1955.653032928961,
        },
        {
            amount: 166.066316982854,
            output: 324722.368614,
            distribution: [0.0, 59.97, 21.07, 18.96, 0.0],
            gas_costs: [0, 132000, 132000, 136000, 0],
            gas_costs_usd: [0.0, 0.16360745245204533, 0.16360745245204533, 0.16856525404150127, 0.0],
            gas_costs_output: [0.0, 4.267868092302238e-8, 4.267868092302238e-8, 4.3971974284326094e-8, 0.0],
            ratio: 1955.377673893538,
        },
        {
            amount: 228.39693532508232,
            output: 446491.991377,
            distribution: [5.11, 60.11, 20.11, 14.66, 0.0],
            gas_costs: [120000, 132000, 132000, 138000, 0],
            gas_costs_usd: [0.1487340476836776, 0.16360745245204533, 0.16360745245204533, 0.17104415483622926, 0.0],
            gas_costs_output: [3.8798800839111255e-8, 4.267868092302238e-8, 4.267868092302238e-8, 4.4618620964977946e-8, 0.0],
            ratio: 1954.89484454552,
        },
        {
            amount: 314.12246031370574,
            output: 613895.66825,
            distribution: [5.68, 61.01, 20.11, 13.2, 0.0],
            gas_costs: [120000, 134000, 132000, 140000, 0],
            gas_costs_usd: [0.1487340476836776, 0.16608635324677332, 0.16360745245204533, 0.17352305563095718, 0.0],
            gas_costs_output: [3.8798800839111255e-8, 4.3325327603674235e-8, 4.267868092302238e-8, 4.52652676456298e-8, 0.0],
            ratio: 1954.3195594384392,
        },
        {
            amount: 432.0238357537168,
            output: 844039.116285,
            distribution: [5.68, 62.31, 20.12, 11.88, 0.0],
            gas_costs: [120000, 134000, 132000, 142000, 0],
            gas_costs_usd: [0.1487340476836776, 0.16608635324677332, 0.16360745245204533, 0.17600195642568514, 0.0],
            gas_costs_output: [3.8798800839111255e-8, 4.3325327603674235e-8, 4.267868092302238e-8, 4.591191432628165e-8, 0.0],
            ratio: 1953.6864553143778,
        },
        {
            amount: 594.1778071932757,
            output: 1160217.679157,
            distribution: [6.32, 62.87, 20.12, 10.69, 0.0],
            gas_costs: [120000, 134000, 132000, 142000, 0],
            gas_costs_usd: [0.1487340476836776, 0.16608635324677332, 0.16360745245204533, 0.17600195642568514, 0.0],
            gas_costs_output: [3.8798800839111255e-8, 4.3325327603674235e-8, 4.267868092302238e-8, 4.591191432628165e-8, 0.0],
            ratio: 1952.6439141803914,
        },
        {
            amount: 817.1939539981095,
            output: 1594601.032736,
            distribution: [5.69, 63.47, 20.14, 10.7, 0.0],
            gas_costs: [120000, 136000, 132000, 144000, 0],
            gas_costs_usd: [0.1487340476836776, 0.16856525404150127, 0.16360745245204533, 0.17848085722041312, 0.0],
            gas_costs_output: [3.8798800839111255e-8, 4.3971974284326094e-8, 4.267868092302238e-8, 4.65585610069335e-8, 0.0],
            ratio: 1951.3128125023907,
        },
        {
            amount: 1123.9160237330059,
            output: 2191028.468797,
            distribution: [6.32, 63.91, 20.14, 9.63, 0.0],
            gas_costs: [120000, 138000, 134000, 150000, 0],
            gas_costs_usd: [0.1487340476836776, 0.17104415483622926, 0.16608635324677332, 0.185917559604597, 0.0],
            gas_costs_output: [3.8798800839111255e-8, 4.4618620964977946e-8, 4.3325327603674235e-8, 4.8498501048889074e-8, 0.0],
            ratio: 1949.459232300699,
        },
        {
            amount: 1545.761838084689,
            output: 3010010.942306,
            distribution: [6.32, 64.85, 20.15, 8.68, 0.0],
            gas_costs: [120000, 140000, 134000, 158000, 0],
            gas_costs_usd: [0.1487340476836776, 0.17352305563095718, 0.16608635324677332, 0.19583316278350882, 0.0],
            gas_costs_output: [3.8798800839111255e-8, 4.52652676456298e-8, 4.3325327603674235e-8, 5.108508777149649e-8, 0.0],
            ratio: 1947.266951573615,
        },
        {
            amount: 2125.941449026418,
            output: 4131822.861697,
            distribution: [7.03, 65.01, 20.15, 7.81, 0.0],
            gas_costs: [120000, 144000, 134000, 160000, 0],
            gas_costs_usd: [0.1487340476836776, 0.17848085722041312, 0.16608635324677332, 0.1983120635782368, 0.0],
            gas_costs_output: [3.8798800839111255e-8, 4.65585610069335e-8, 4.3325327603674235e-8, 5.173173445214834e-8, 0.0],
            ratio: 1943.5261792318797,
        },
    ],
    trades1to0: [
        {
            amount: 6.8729220471192995,
            output: 0.003505253318034981,
            distribution: [0.0, 29.8, 20.04, 30.12, 20.04],
            gas_costs: [0, 132000, 132000, 132000, 120000],
            gas_costs_usd: [0.0, 0.16360745245204533, 0.16360745245204533, 0.16360745245204533, 0.1487340476836776],
            gas_costs_output: [0.0, 0.000083472338268, 0.000083472338268, 0.000083472338268, 0.00007588394388],
            ratio: 0.0005100091806708967,
        },
        {
            amount: 228.89553338714475,
            output: 0.11674688640117223,
            distribution: [0.0, 20.02, 20.02, 39.94, 20.02],
            gas_costs: [0, 132000, 132000, 132000, 120000],
            gas_costs_usd: [0.0, 0.16360745245204533, 0.16360745245204533, 0.16360745245204533, 0.1487340476836776],
            gas_costs_output: [0.0, 0.000083472338268, 0.000083472338268, 0.000083472338268, 0.00007588394388],
            ratio: 0.0005100444070316227,
        },
        {
            amount: 432.96695807260835,
            output: 0.22083027492540594,
            distribution: [0.0, 20.02, 20.02, 39.94, 20.02],
            gas_costs: [0, 132000, 132000, 132000, 120000],
            gas_costs_usd: [0.0, 0.16360745245204533, 0.16360745245204533, 0.16360745245204533, 0.1487340476836776],
            gas_costs_output: [0.0, 0.000083472338268, 0.000083472338268, 0.000083472338268, 0.00007588394388],
            ratio: 0.0005100395557792333,
        },
        {
            amount: 818.9779154212893,
            output: 0.4177036061551367,
            distribution: [0.0, 20.02, 20.02, 39.94, 20.02],
            gas_costs: [0, 132000, 132000, 132000, 120000],
            gas_costs_usd: [0.0, 0.16360745245204533, 0.16360745245204533, 0.16360745245204533, 0.1487340476836776],
            gas_costs_output: [0.0, 0.000083472338268, 0.000083472338268, 0.000083472338268, 0.00007588394388],
            ratio: 0.0005100303665149953,
        },
        {
            amount: 1126.3695695765898,
            output: 0.5744857463917965,
            distribution: [0.0, 20.02, 20.02, 41.93, 18.02],
            gas_costs: [0, 132000, 132000, 132000, 120000],
            gas_costs_usd: [0.0, 0.16360745245204533, 0.16360745245204533, 0.16360745245204533, 0.1487340476836776],
            gas_costs_output: [0.0, 0.000083472338268, 0.000083472338268, 0.000083472338268, 0.00007588394388],
            ratio: 0.0005100330852349195,
        },
        {
            amount: 1549.1362872898944,
            output: 0.7901357668343506,
            distribution: [0.0, 20.03, 20.03, 46.79, 13.14],
            gas_costs: [0, 132000, 132000, 132000, 120000],
            gas_costs_usd: [0.0, 0.16360745245204533, 0.16360745245204533, 0.16360745245204533, 0.1487340476836776],
            gas_costs_output: [0.0, 0.000083472338268, 0.000083472338268, 0.000083472338268, 0.00007588394388],
            ratio: 0.000510049227730956,
        },
        {
            amount: 2130.582449506718,
            output: 1.0867199882312406,
            distribution: [0.0, 20.04, 20.04, 50.33, 9.59],
            gas_costs: [0, 132000, 132000, 132000, 120000],
            gas_costs_usd: [0.0, 0.16360745245204533, 0.16360745245204533, 0.16360745245204533, 0.1487340476836776],
            gas_costs_output: [0.0, 0.000083472338268, 0.000083472338268, 0.000083472338268, 0.00007588394388],
            ratio: 0.0005100577021749608,
        },
        {
            amount: 2930.266117571472,
            output: 1.49460964845525,
            distribution: [0.0, 20.06, 20.06, 52.89, 6.99],
            gas_costs: [0, 132000, 132000, 132000, 120000],
            gas_costs_usd: [0.0, 0.16360745245204533, 0.16360745245204533, 0.16360745245204533, 0.1487340476836776],
            gas_costs_output: [0.0, 0.000083472338268, 0.000083472338268, 0.000083472338268, 0.00007588394388],
            ratio: 0.0005100593559691527,
        },
        {
            amount: 4030.099619836521,
            output: 2.0555698485191263,
            distribution: [0.0, 20.08, 20.08, 54.73, 5.1],
            gas_costs: [0, 132000, 132000, 132000, 120000],
            gas_costs_usd: [0.0, 0.16360745245204533, 0.16360745245204533, 0.16360745245204533, 0.1487340476836776],
            gas_costs_output: [0.0, 0.000083472338268, 0.000083472338268, 0.000083472338268, 0.00007588394388],
            ratio: 0.0005100543517157972,
        },
        {
            amount: 5542.739906253695,
            output: 2.827057164470821,
            distribution: [0.0, 20.89, 20.89, 58.22, 0.0],
            gas_costs: [0, 132000, 132000, 132000, 0],
            gas_costs_usd: [0.0, 0.16360745245204533, 0.16360745245204533, 0.16360745245204533, 0.0],
            gas_costs_output: [0.0, 0.000083472338268, 0.000083472338268, 0.000083472338268, 0.0],
            ratio: 0.0005100468743645249,
        },
        {
            amount: 7623.128102630736,
            output: 3.8879770784252248,
            distribution: [0.0, 20.72, 20.72, 58.56, 0.0],
            gas_costs: [0, 132000, 132000, 132000, 0],
            gas_costs_usd: [0.0, 0.16360745245204533, 0.16360745245204533, 0.16360745245204533, 0.0],
            gas_costs_output: [0.0, 0.000083472338268, 0.000083472338268, 0.000083472338268, 0.0],
            ratio: 0.0005100238414470795,
        },
        {
            amount: 10484.360271632533,
            output: 5.346931086636396,
            distribution: [0.0, 20.62, 20.62, 58.76, 0.0],
            gas_costs: [0, 132000, 132000, 134000, 0],
            gas_costs_usd: [0.0, 0.16360745245204533, 0.16360745245204533, 0.16608635324677332, 0.0],
            gas_costs_output: [0.0, 0.000083472338268, 0.000083472338268, 0.000084737070666, 0.0],
            ratio: 0.0005099911628777332,
        },
        {
            amount: 14419.515037068928,
            output: 7.353332864553221,
            distribution: [0.0, 34.22, 20.59, 45.18, 0.0],
            gas_costs: [0, 132000, 132000, 134000, 0],
            gas_costs_usd: [0.0, 0.16360745245204533, 0.16360745245204533, 0.16608635324677332, 0.0],
            gas_costs_output: [0.0, 0.000083472338268, 0.000083472338268, 0.000084737070666, 0.0],
            ratio: 0.0005099570162855555,
        },
        {
            amount: 19831.67389495678,
            output: 10.112788164854173,
            distribution: [0.0, 46.17, 20.6, 33.23, 0.0],
            gas_costs: [0, 132000, 132000, 134000, 0],
            gas_costs_usd: [0.0, 0.16360745245204533, 0.16360745245204533, 0.16608635324677332, 0.0],
            gas_costs_output: [0.0, 0.000083472338268, 0.000083472338268, 0.000084737070666, 0.0],
            ratio: 0.0005099311444362627,
        },
        {
            amount: 27275.209219231507,
            output: 13.907921411096435,
            distribution: [0.0, 54.78, 20.65, 24.57, 0.0],
            gas_costs: [0, 132000, 132000, 134000, 0],
            gas_costs_usd: [0.0, 0.16360745245204533, 0.16360745245204533, 0.16608635324677332, 0.0],
            gas_costs_output: [0.0, 0.000083472338268, 0.000083472338268, 0.000084737070666, 0.0],
            ratio: 0.0005099107141370022,
        },
        {
            amount: 37512.56913023547,
            output: 19.127377073541922,
            distribution: [0.0, 58.64, 20.68, 20.68, 0.0],
            gas_costs: [0, 132000, 132000, 134000, 0],
            gas_costs_usd: [0.0, 0.16360745245204533, 0.16360745245204533, 0.16608635324677332, 0.0],
            gas_costs_output: [0.0, 0.000083472338268, 0.000083472338268, 0.000084737070666, 0.0],
            ratio: 0.000509892484496487,
        },
        {
            amount: 51592.37575191526,
            output: 26.30530643167104,
            distribution: [0.0, 58.47, 20.77, 20.77, 0.0],
            gas_costs: [0, 132000, 132000, 134000, 0],
            gas_costs_usd: [0.0, 0.16360745245204533, 0.16360745245204533, 0.16608635324677332, 0.0],
            gas_costs_output: [0.0, 0.000083472338268, 0.000083472338268, 0.000084737070666, 0.0],
            ratio: 0.0005098680967635256,
        },
        {
            amount: 70956.83653352871,
            output: 36.17740966877902,
            distribution: [0.0, 62.14, 20.92, 16.94, 0.0],
            gas_costs: [0, 132000, 132000, 134000, 0],
            gas_costs_usd: [0.0, 0.16360745245204533, 0.16360745245204533, 0.16608635324677332, 0.0],
            gas_costs_output: [0.0, 0.000083472338268, 0.000083472338268, 0.000084737070666, 0.0],
            ratio: 0.0005098509380692858,
        },
        {
            amount: 97589.47087562653,
            output: 49.75365970220206,
            distribution: [0.0, 63.67, 21.01, 15.32, 0.0],
            gas_costs: [0, 132000, 132000, 134000, 0],
            gas_costs_usd: [0.0, 0.16360745245204533, 0.16360745245204533, 0.16608635324677332, 0.0],
            gas_costs_output: [0.0, 0.000083472338268, 0.000083472338268, 0.000084737070666, 0.0],
            ratio: 0.0005098261037395143,
        },
        {
            amount: 134218.28383350463,
            output: 68.4240540632659,
            distribution: [0.0, 65.04, 21.11, 13.85, 0.0],
            gas_costs: [0, 132000, 132000, 134000, 0],
            gas_costs_usd: [0.0, 0.16360745245204533, 0.16360745245204533, 0.16608635324677332, 0.0],
            gas_costs_output: [0.0, 0.000083472338268, 0.000083472338268, 0.000084737070666, 0.0],
            ratio: 0.0005097968183559996,
        },
        {
            amount: 184595.1981661011,
            output: 94.09628181015569,
            distribution: [5.12, 62.85, 20.14, 11.89, 0.0],
            gas_costs: [120000, 134000, 132000, 136000, 0],
            gas_costs_usd: [0.1487340476836776, 0.16608635324677332, 0.16360745245204533, 0.16856525404150127, 0.0],
            gas_costs_output: [0.00007588394388, 0.000084737070666, 0.000083472338268, 0.000086001803064, 0.0],
            ratio: 0.0005097439302052602,
        },
        {
            amount: 253880.36721026804,
            output: 129.39772655683504,
            distribution: [5.12, 62.85, 20.14, 11.89, 0.0],
            gas_costs: [120000, 134000, 132000, 136000, 0],
            gas_costs_usd: [0.1487340476836776, 0.16608635324677332, 0.16360745245204533, 0.16856525404150127, 0.0],
            gas_costs_output: [0.00007588394388, 0.000084737070666, 0.000083472338268, 0.000086001803064, 0.0],
            ratio: 0.0005096799251507394,
        },
        {
            amount: 349170.7340990685,
            output: 177.9352054783019,
            distribution: [5.12, 62.85, 20.14, 11.89, 0.0],
            gas_costs: [120000, 134000, 132000, 138000, 0],
            gas_costs_usd: [0.1487340476836776, 0.16608635324677332, 0.16360745245204533, 0.17104415483622926, 0.0],
            gas_costs_output: [0.00007588394388, 0.000084737070666, 0.000083472338268, 0.000087266535462, 0.0],
            ratio: 0.0005095936975859268,
        },
        {
            amount: 480226.97812748165,
            output: 244.65478385246752,
            distribution: [5.12, 61.56, 20.12, 13.2, 0.0],
            gas_costs: [120000, 134000, 132000, 140000, 0],
            gas_costs_usd: [0.1487340476836776, 0.16608635324677332, 0.16360745245204533, 0.17352305563095718, 0.0],
            gas_costs_output: [0.00007588394388, 0.000084737070666, 0.000083472338268, 0.00008853126786, 0.0],
            ratio: 0.0005094565590768758,
        },
        {
            amount: 660473.3100455683,
            output: 336.3884086622357,
            distribution: [5.12, 61.56, 20.12, 13.2, 0.0],
            gas_costs: [120000, 134000, 132000, 144000, 0],
            gas_costs_usd: [0.1487340476836776, 0.16608635324677332, 0.16360745245204533, 0.17848085722041312, 0.0],
            gas_costs_output: [0.00007588394388, 0.000084737070666, 0.000083472338268, 0.000091060732656, 0.0],
            ratio: 0.0005093141593251006,
        },
        {
            amount: 908372.5262239388,
            output: 462.4215683334188,
            distribution: [5.11, 60.11, 20.11, 14.66, 0.0],
            gas_costs: [120000, 134000, 134000, 154000, 0],
            gas_costs_usd: [0.1487340476836776, 0.16608635324677332, 0.16608635324677332, 0.19087536119405293, 0.0],
            gas_costs_output: [0.00007588394388, 0.000084737070666, 0.000084737070666, 0.000097384394646, 0.0],
            ratio: 0.0005090659998890115,
        },
        {
            amount: 1249317.1697453337,
            output: 635.7269016101118,
            distribution: [5.12, 61.56, 20.12, 13.2, 0.0],
            gas_costs: [120000, 134000, 134000, 154000, 0],
            gas_costs_usd: [0.1487340476836776, 0.16608635324677332, 0.16608635324677332, 0.19087536119405293, 0.0],
            gas_costs_output: [0.00007588394388, 0.000084737070666, 0.000084737070666, 0.000097384394646, 0.0],
            ratio: 0.0005088594930139886,
        },
        {
            amount: 1718230.511779825,
            output: 873.7503884179041,
            distribution: [5.68, 62.31, 20.12, 11.88, 0.0],
            gas_costs: [120000, 136000, 134000, 156000, 0],
            gas_costs_usd: [0.1487340476836776, 0.16856525404150127, 0.16608635324677332, 0.19335426198878086, 0.0],
            gas_costs_output: [0.00007588394388, 0.000086001803064, 0.000084737070666, 0.000098649127044, 0.0],
            ratio: 0.0005085175606113823,
        },
    ],
    aggt0lqdty: [5028.293844095968, 60492.5930375181, 16948.137517738545, 2002.751402224554, 565.8821594795583],
    aggt1lqdty: [9818791.236218, 45045258.779216, 12135470.971409, 625181.471759, 1104518.012591],
    pools: [
        {
            address: '0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc',
            id: '0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc',
            tokens: [
                {
                    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                    decimals: 6,
                    symbol: 'USDC',
                    gas: '40652',
                },
                {
                    address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
                    decimals: 18,
                    symbol: 'WETH',
                    gas: '29962',
                },
            ],
            protocol_system: 'uniswap_v2',
            protocol_type_name: 'uniswap_v2_pool',
            contract_ids: [],
            static_attributes: [
                ['fee', '0x1e'],
                ['pool_address', '0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc'],
            ],
            creation_tx: '0xd07cbde817318492092cc7a27b3064a69bd893c01cb593d6029683ffd290ab3a',
            fee: 30,
        },
        {
            address: '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640',
            id: '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640',
            tokens: [
                {
                    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                    decimals: 6,
                    symbol: 'USDC',
                    gas: '40652',
                },
                {
                    address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
                    decimals: 18,
                    symbol: 'WETH',
                    gas: '29962',
                },
            ],
            protocol_system: 'uniswap_v3',
            protocol_type_name: 'uniswap_v3_pool',
            contract_ids: [],
            static_attributes: [
                ['pool_address', '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640'],
                ['fee', '0x01f4'],
                ['tick_spacing', '0x0a'],
            ],
            creation_tx: '0x125e0b641d4a4b08806bf52c0c6757648c9963bcda8681e4f996f09e00d4c2cc',
            fee: 5,
        },
        {
            address: '0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8',
            id: '0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8',
            tokens: [
                {
                    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                    decimals: 6,
                    symbol: 'USDC',
                    gas: '40652',
                },
                {
                    address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
                    decimals: 18,
                    symbol: 'WETH',
                    gas: '29962',
                },
            ],
            protocol_system: 'uniswap_v3',
            protocol_type_name: 'uniswap_v3_pool',
            contract_ids: [],
            static_attributes: [
                ['tick_spacing', '0x3c'],
                ['pool_address', '0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8'],
                ['fee', '0x0bb8'],
            ],
            creation_tx: '0x89d75075eaef8c21ab215ae54144ba563b850ee7460f89b2a175fd0e267ed330',
            fee: 30,
        },
        {
            address: '0xe0554a476a092703abdb3ef35c80e0d76d32939f',
            id: '0xe0554a476a092703abdb3ef35c80e0d76d32939f',
            tokens: [
                {
                    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                    decimals: 6,
                    symbol: 'USDC',
                    gas: '40652',
                },
                {
                    address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
                    decimals: 18,
                    symbol: 'WETH',
                    gas: '29962',
                },
            ],
            protocol_system: 'uniswap_v3',
            protocol_type_name: 'uniswap_v3_pool',
            contract_ids: [],
            static_attributes: [
                ['pool_address', '0xe0554a476a092703abdb3ef35c80e0d76d32939f'],
                ['fee', '0x64'],
                ['tick_spacing', '0x01'],
            ],
            creation_tx: '0x9a773c2ab3acc47552e73d553b35e29c8fb0ca9576882f46552254232edb3cfd',
            fee: 1,
        },
        {
            address: '0x397ff1542f962076d0bfe58ea045ffa2d347aca0',
            id: '0x397ff1542f962076d0bfe58ea045ffa2d347aca0',
            tokens: [
                {
                    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                    decimals: 6,
                    symbol: 'USDC',
                    gas: '40652',
                },
                {
                    address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
                    decimals: 18,
                    symbol: 'WETH',
                    gas: '29962',
                },
            ],
            protocol_system: 'sushiswap_v2',
            protocol_type_name: 'sushiswap_v2_pool',
            contract_ids: [],
            static_attributes: [
                ['pool_address', '0x397ff1542f962076d0bfe58ea045ffa2d347aca0'],
                ['fee', '0x1e'],
            ],
            creation_tx: '0x9011586359ddfc2660fe5bcdf2b53f1d4238ab4f4f998bc79a8cd69aa7c9040d',
            fee: 30,
        },
    ],
    eth_usd: 1960.02,
    mpd0to1: {
        best_ask: 1955.57502390478,
        best_bid: 1960.7490176638387,
        mid: 1958.1620207843093,
        spread: 5.173993759058703,
        spread_pct: 0.0026422705088449965,
    },
    mpd1to0: {
        best_ask: 0.0005100091806708967,
        best_bid: 0.0005113585455817785,
        mid: 0.0005106838631263376,
        spread: 1.349364910881775e-6,
        spread_pct: 0.0026422705088450325,
    },
}

export default function Dashboard() {
    console.log('render dashboard')
    const account = useAccount()
    const { setOpen } = useModal()
    const {
        sellToken,
        sellTokenAmountInput,
        buyToken,
        buyTokenAmountInput,
        yAxisType,
        yAxisLogBase,
        switchSelectedTokens,
        setShowSelectTokenModal,
        setSelectTokenModalFor,
        setSellTokenAmountInput,
        setBuyTokenAmountInput,
        setYAxisType,
    } = useAppStore()
    const [openChartOptions, showChartOptions] = useState(false)
    const chartOptionsDropdown = useRef<HTMLDivElement>(null)
    useClickOutside(chartOptionsDropdown, () => showChartOptions(false))
    if (!sellToken || !buyToken) return
    // useQueries({
    //     queries: [
    //         {
    //             queryKey: ['AvailableTokensQuery'],
    //             enabled: true,
    //             queryFn: async () => {
    //                 const [tokensResponse] = await Promise.all([
    //                     fetch(`${root}/api/local/tokens`, { method: 'GET', headers: { 'Content-Type': 'application/json' } }),
    //                 ])
    //                 const [tokensResponseJson] = (await Promise.all([tokensResponse.json()])) as [APIResponse<Token[]>]
    //                 if (tokensResponseJson?.data) setAvailableTokens(tokensResponseJson.data)
    //                 return { tokensResponseJson }
    //             },
    //             refetchOnWindowFocus: false,
    //             refetchInterval: 1000 * 60 * 5,
    //         },
    //     ],
    // })

    return (
        <div className="w-full grid grid-cols-1 md:grid-cols-11 gap-4">
            {/* left */}
            <div className="col-span-1 md:col-span-7 flex flex-col gap-4">
                {/* metrics */}
                <div className="w-full grid grid-cols-2 md:grid-cols-3 gap-2">
                    {/* mid price */}
                    <OrderbookKeyMetric
                        title={`Mid-price 1 ${sellToken.symbol}`}
                        content={
                            <div className="flex gap-1.5 items-center flex-wrap">
                                <TokenImage size={20} token={buyToken} />
                                <p className="text-milk font-bold text-base">1984.21</p>
                            </div>
                        }
                    />

                    {/* bid */}
                    <OrderbookKeyMetric
                        title="Best bid"
                        content={
                            <div className="flex gap-1.5 items-center flex-wrap">
                                <TokenImage size={20} token={buyToken} />
                                <p className="text-milk font-bold text-base">1984.21</p>
                            </div>
                        }
                    />

                    {/* ask */}
                    <OrderbookKeyMetric
                        title="Best ask"
                        content={
                            <div className="flex gap-1.5 items-center flex-wrap">
                                <TokenImage size={20} token={buyToken} />
                                <p className="text-milk font-bold text-base">1987.34</p>
                            </div>
                        }
                    />

                    {/* spread */}
                    <OrderbookKeyMetric title="Spread" content={<p className="text-milk font-bold text-base">0.16%</p>} />

                    {/* last block */}
                    <OrderbookComponentLayout
                        title={
                            <div className="w-full flex justify-between">
                                <p className="text-milk-600 text-xs">Last block</p>
                                <p className="text-milk-600 text-xs">3s</p>
                            </div>
                        }
                        content={<p className="text-milk font-bold text-base">20773013</p>}
                    />

                    {/* TVL */}
                    <OrderbookKeyMetric title="Total TVL" content={<p className="text-milk font-bold text-base">$5.4B</p>} />
                </div>

                <OrderbookComponentLayout
                    title={
                        <div className="w-full flex justify-between">
                            {/* title */}
                            <p className="text-milk text-base font-bold">Market depth</p>
                            <button onClick={() => showChartOptions(!openChartOptions)} className="relative">
                                <div className="flex items-center gap-1 hover:bg-milk-100/5 transition-colors duration-300 rounded-lg px-2.5 py-1.5">
                                    <p className="text-milk text-sm">{yAxisType === 'value' ? 'Linear' : `Log ${yAxisLogBase}`}</p>
                                    <IconWrapper icon={IconIds.TRIANGLE_DOWN} className="size-4" />
                                </div>

                                {/* options dropdown */}
                                <div
                                    ref={chartOptionsDropdown}
                                    className={cn(
                                        `z-20 absolute mt-2 w-52 rounded-2xl backdrop-blur-lg border border-milk-150 shadow-lg p-2.5 transition-all origin-top-left`,
                                        {
                                            'scale-100 opacity-100': openChartOptions,
                                            'scale-95 opacity-0 pointer-events-none': !openChartOptions,
                                        },
                                    )}
                                >
                                    {[OrderbookAxisScale.VALUE, OrderbookAxisScale.LOG].map((type, typeIndex) => (
                                        <div
                                            key={`${type}-${typeIndex}`}
                                            className={cn('flex items-center gap-2 w-full px-4 py-2 rounded-lg transition mt-1', {
                                                'text-white bg-gray-600/20': yAxisType === type,
                                                'text-milk-600 hover:bg-gray-600/20': yAxisType !== type,
                                            })}
                                            onClick={() => setYAxisType(type)}
                                        >
                                            <p className="text-sm">{type === 'value' ? 'Linear' : `Log ${yAxisLogBase}`}</p>
                                        </div>
                                    ))}
                                </div>
                            </button>
                        </div>
                    }
                    content={<DepthChart orderbook={orderbookHardcoded} />}
                />

                {/* routes */}
                <OrderbookComponentLayout title={<p className="text-milk text-base font-bold">Routing</p>} content={undefined} />
            </div>

            {/* right */}
            <div className="col-span-1 md:col-span-4 flex flex-col gap-0.5">
                {/* sell */}
                <div className="bg-milk-600/5 flex flex-col gap-1 p-4 rounded-xl border-milk-150 w-full">
                    <div className="flex justify-between">
                        <p className="text-milk-600 text-xs">Sell</p>
                        <button
                            onClick={() => {}}
                            className="flex transition-colors duration-300 opacity-80 hover:opacity-100 hover:hover:bg-milk-100/5 px-2.5 py-1.5 rounded-lg"
                        >
                            <p className="font-bold text-folly text-xs">Best bid</p>
                        </button>
                    </div>
                    <div className="flex justify-between gap-3">
                        <button
                            onClick={() => {
                                setSelectTokenModalFor('sell')
                                setShowSelectTokenModal(true)
                            }}
                            className="flex rounded-full bg-gray-600/30 transition-colors duration-300 hover:bg-gray-600/50 items-center gap-1.5 pl-1.5 pr-2 py-1.5 min-w-fit"
                        >
                            <TokenImage size={24} token={sellToken} />
                            <p className="font-semibold tracking-wide">{sellToken.symbol}</p>
                            <IconWrapper icon={IconIds.TRIANGLE_DOWN} className="size-4" />
                        </button>
                        <input
                            type="text"
                            className="text-xl font-bold text-right border-none outline-none ring-0 focus:ring-0 focus:outline-none focus:border-none bg-transparent w-40"
                            value={numeral(sellTokenAmountInput).format('0,0.[00000]')}
                            onChange={(e) => {
                                const parsedNumber = Number(numeral(e.target.value ?? 0).value())
                                if (isNaN(parsedNumber)) return
                                setSellTokenAmountInput(parsedNumber)
                            }}
                        />
                    </div>
                    <div className="mt-2 flex justify-between items-center">
                        <div className="flex justify-between gap-1 items-center">
                            <IconWrapper icon={IconIds.WALLET} className="size-4 text-milk-400" />
                            <p className="text-milk-600 text-xs">{account.isConnected ? 0.1025 : '-'}</p>
                        </div>
                        <p className="text-milk-600 text-xs">$1,984.21</p>
                    </div>
                </div>

                {/* arrow */}
                <div className="h-0 w-full flex justify-center items-center z-10">
                    <div className="size-[44px] rounded-xl bg-background p-1">
                        <button
                            onClick={() => switchSelectedTokens()}
                            className="size-full rounded-lg bg-milk-600/5 flex items-center justify-center group"
                        >
                            <IconWrapper icon={IconIds.ARROW_DOWN} className="size-5 transition-transform duration-300 group-hover:rotate-180" />
                        </button>
                    </div>
                </div>

                {/* buy */}
                <div className="bg-milk-600/5 flex flex-col gap-3 p-4 rounded-xl border-milk-150 w-full">
                    <p className="text-milk-600 text-xs">Buy</p>
                    <div className="flex justify-between gap-3 w-full">
                        <button
                            onClick={() => {
                                setSelectTokenModalFor('buy')
                                setShowSelectTokenModal(true)
                            }}
                            className="flex rounded-full bg-gray-600/30 transition-colors duration-300 hover:bg-gray-600/50 items-center gap-1.5 pl-1.5 pr-2 py-1.5 min-w-fit"
                        >
                            <TokenImage size={24} token={buyToken} />
                            <p className="font-semibold tracking-wide">{buyToken.symbol}</p>
                            <IconWrapper icon={IconIds.TRIANGLE_DOWN} className="size-4" />
                        </button>
                        <input
                            type="text"
                            className="text-xl font-bold text-right border-none outline-none ring-0 focus:ring-0 focus:outline-none focus:border-none bg-transparent w-40"
                            value={numeral(buyTokenAmountInput).format('0,0.[00000]')}
                            onChange={(e) => {
                                const parsedNumber = Number(numeral(e.target.value ?? 0).value())
                                if (isNaN(parsedNumber)) return
                                setBuyTokenAmountInput(parsedNumber)
                            }}
                        />
                    </div>
                    <div className="flex justify-between items-center">
                        <div className="flex justify-between gap-1 items-center">
                            <IconWrapper icon={IconIds.WALLET} className="size-4 text-milk-400" />
                            <p className="text-milk-600 text-xs">{account.isConnected ? 0.1025 : '-'}</p>
                        </div>
                        <p className="text-milk-600 text-xs">$ 1987.92</p>
                    </div>
                </div>

                {/* separator */}
                <div className="h-0 w-full" />

                {/* fees */}
                <div className="bg-milk-600/5 flex justify-between p-4 rounded-xl border-milk-150 text-sm">
                    <p className="text-milk-600 truncate">1 WETH = 1984.21 USDC ($1,984.21)</p>
                    <div className="flex gap-1.5 items-center">
                        <IconWrapper icon={IconIds.GAS} className="size-4 text-milk-600" />
                        <ChainImage networkName="ethereum" className="size-4" />
                        <p className="text-milk-600">$4.54</p>
                        <IconWrapper icon={IconIds.TRIANGLE_DOWN} className="size-4" />
                    </div>
                </div>

                {/* separator */}
                <div className="h-0 w-full" />

                {/* fees */}
                {account.isConnected ? (
                    <button className="bg-folly flex justify-center p-4 rounded-xl border-milk-150 transition-all duration-300 hover:opacity-90">
                        <p className="font-bold">Swap</p>
                    </button>
                ) : (
                    <button
                        onClick={() => setOpen(true)}
                        className="bg-folly flex justify-center p-4 rounded-xl border-milk-150 transition-all duration-300 hover:opacity-90"
                    >
                        <p className="font-bold">Connect wallet</p>
                    </button>
                )}
            </div>
            <SelectTokenModal />
        </div>
    )
}
