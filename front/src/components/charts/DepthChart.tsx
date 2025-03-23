'use client'

import * as echarts from 'echarts'
import { ErrorBoundary } from 'react-error-boundary'
import { Suspense, useEffect, useState } from 'react'
import { OrderbookSide } from '@/enums'
import EchartWrapper from './EchartWrapper'
import { ChartBackground, CustomFallback, LoadingArea } from './ChartsCommons'
import { useAppStore } from '@/stores/app.store'
import { APP_FONT } from '@/config/app.config'
import { ErrorBoundaryFallback } from '../common/ErrorBoundaryFallback'
import { AppColors, formatAmount } from '@/utils'
import { AmmAsOrderbook, AmmPool } from '@/interfaces'
import numeral from 'numeral'
import { OrderbookDataPoint } from '@/types'
import toast from 'react-hot-toast'
import { toastStyle } from '@/config/toasts.config'

const getOptions = (
    token0: string,
    token1: string,
    bids: OrderbookDataPoint[],
    asks: OrderbookDataPoint[],
    pools: AmmPool[],
    yAxisType: 'value' | 'log',
    yAxisLogBase: number,
): echarts.EChartsOption => {
    return {
        tooltip: {
            trigger: 'axis',
            triggerOn: 'mousemove|click',
            axisPointer: {
                type: 'line',
                snap: true,
                lineStyle: {
                    color: AppColors.milk[600],
                    width: 2,
                    type: 'dotted',
                },
            },
            textStyle: {
                fontSize: 11,
            },
            formatter: (params) => {
                // ensure params is an array
                const [firstSerieDataPoints] = Array.isArray(params) ? params : [params]
                const [price, input, side, distribution, output] = firstSerieDataPoints.data as OrderbookDataPoint
                const distributionLines = distribution.map((percent, percentIndex) => {
                    const protocolName = pools[percentIndex].protocol_system
                    const attributes = pools[percentIndex].static_attributes
                    const hexaPercent = attributes.find((entry) => entry[0].toLowerCase() === 'fee')?.[1] ?? '0'
                    // https://github.com/adamwdraper/Numeral-js/issues/123
                    return `- ${numeral(percent / 100).format('#4#0,0%')} in ${protocolName} ${numeral(parseInt(hexaPercent, 16)).divide(100).format('0,0.[0]')}bps`
                })
                return [
                    `<strong>You sell</strong>`,
                    `= ${numeral(input).format('0,0.[0000000]')} ${side === OrderbookSide.BID ? token0 : token1}`,
                    ``,
                    `<strong>Simulated price</strong>`,
                    `= ${numeral(price).format('0,0.[0000000]')} ${token1} for 1 ${token0}`,
                    `= ${numeral(1 / price).format('0,0.[0000000]')} ${token0} for 1 ${token1}`,
                    ``,
                    `<strong>You buy</strong>`,
                    `= ${numeral(output).format('0,0.[0000000]')} ${side === OrderbookSide.BID ? token1 : token0}`,
                    ``,
                    `<strong>Distribution</strong>`,
                    ...distributionLines,
                ]
                    .filter((line) => !!line)
                    .join('<br/>')
            },
        },
        toolbox: {
            feature: {
                dataZoom: {
                    yAxisIndex: 'none',
                },
                restore: { show: true },
                saveAsImage: { show: true },
                dataView: { show: true, readOnly: false },
            },
            itemSize: 8,
        },
        legend: {
            show: false,
        },
        xAxis: [
            {
                type: 'value',
                position: 'bottom',
                nameLocation: 'middle',
                splitLine: {
                    show: false,
                },
                axisLabel: {
                    margin: 15,
                    hideOverlap: true,
                    showMinLabel: true,
                    showMaxLabel: true,
                    formatter: (value) => `${formatAmount(value)}\n${formatAmount(1 / Number(value))}`,
                    fontSize: 10,
                    color: AppColors.milk[200],
                },
                axisLine: {
                    lineStyle: {
                        color: AppColors.milk[150],
                    },
                },
                axisTick: {
                    show: false,
                },
                min: 'dataMin',
                max: 'dataMax',
            },
        ],
        dataZoom: [
            {
                show: true,
                type: 'slider',
                height: 25,
                bottom: '3%',
                backgroundColor: AppColors.milk[50],
                fillerColor: 'transparent',
                borderColor: AppColors.milk[200],
                labelFormatter: (index: number) => `${formatAmount(index)} ${token1}\n${formatAmount(1 / Number(index))} ${token0}`,
                textStyle: { color: AppColors.milk[200], fontSize: 10 },
                handleLabel: { show: true },
                dataBackground: { lineStyle: { color: 'transparent' }, areaStyle: { color: 'transparent' } },
                selectedDataBackground: { lineStyle: { color: AppColors.milk[200] }, areaStyle: { color: AppColors.milk[50] } },
                brushStyle: { color: 'transparent' }, // unknown
                handleStyle: { color: AppColors.milk[600], borderColor: AppColors.milk[600] }, // small candles on left and right
                moveHandleStyle: { color: AppColors.milk[200] }, // top bar
                emphasis: {
                    handleLabel: { show: true },
                    moveHandleStyle: { color: AppColors.milk[400] }, // top bar
                },
            },
        ],
        yAxis: [
            {
                type: yAxisType,
                logBase: yAxisType === 'log' ? yAxisLogBase : undefined,
                nameTextStyle: {
                    fontWeight: 'bold',
                    fontSize: 14,
                },
                position: 'left',
                nameLocation: 'middle',
                alignTicks: true,
                splitLine: {
                    show: true,
                    lineStyle: { color: AppColors.milk[50], type: 'dashed' },
                },
                axisTick: {
                    show: false,
                },
                axisLabel: {
                    fontSize: 11,
                    show: true,
                    color: AppColors.milk[200],
                    formatter: (value) => formatAmount(value),
                },
                axisLine: {
                    show: false,
                },
                axisPointer: {
                    snap: true,
                },
                min: 'dataMin',
                max: 'dataMax',
            },
            {
                type: yAxisType,
                logBase: yAxisType === 'log' ? yAxisLogBase : undefined,
                nameTextStyle: {
                    fontWeight: 'bold',
                    fontSize: 14,
                },
                position: 'right',
                nameLocation: 'middle',
                alignTicks: true,
                splitLine: {
                    show: true,
                    lineStyle: { color: AppColors.milk[50], type: 'dashed' },
                },
                axisTick: {
                    show: false,
                },
                axisLabel: {
                    fontSize: 11,
                    show: true,
                    color: AppColors.milk[200],
                    formatter: (value) => formatAmount(value),
                },
                axisLine: {
                    show: false,
                },
                axisPointer: {
                    snap: true,
                },
                min: 'dataMin',
                max: 'dataMax',
            },
        ],
        textStyle: {
            color: AppColors.milk[600],
            fontFamily: APP_FONT.style.fontFamily,
        },
        grid: {
            left: '10%',
            right: '10%',
            top: '40',
            bottom: '100',
        },
        // @ts-expect-error: poorly typed
        series: [
            {
                yAxisIndex: 0,
                name: 'Bids',
                type: 'line',
                data: bids,
                step: 'start',
                lineStyle: { width: 0.5, color: AppColors.aquamarine, opacity: 0.5 },
                symbol: 'circle',
                symbolSize: 4,
                itemStyle: {
                    color: AppColors.aquamarine,
                    borderColor: AppColors.aquamarine,
                    borderWidth: 1,
                },
                emphasis: {
                    itemStyle: { color: AppColors.aquamarine, borderWidth: 4 },
                },
            },
            {
                yAxisIndex: 1,
                name: 'Asks',
                type: 'line',
                data: asks,
                step: 'end',
                lineStyle: { width: 0.5, color: AppColors.folly, opacity: 0.5 },
                symbol: 'circle',
                symbolSize: 4,
                itemStyle: {
                    color: AppColors.folly,
                    borderColor: AppColors.folly,
                    borderWidth: 1,
                },
                emphasis: {
                    itemStyle: { color: AppColors.folly, borderWidth: 4 },
                },
            },
        ],
    }
}

export default function DepthChart(props: { orderbook: AmmAsOrderbook }) {
    const { storeRefreshedAt, yAxisType, yAxisLogBase, selectOrderbookDataPoint } = useAppStore()
    const [options, setOptions] = useState<echarts.EChartsOption>(
        getOptions(props.orderbook.token0.symbol, props.orderbook.token1.symbol, [], [], props.orderbook.pools, yAxisType, yAxisLogBase),
    )

    // load/refresh chart
    useEffect(() => {
        // example: 0 = WETH, 1 = usdc
        // trades0to1 = traders swap WETH into USDC
        // so traders need USDC liquidity from LPs
        // LPs provided USDC on AMMs (= makers)
        // LPs are ready to buy WETH against their USDC at a low price expressed in 1 weth per x usdc
        // They made bids to buy WETH with their USDC
        const bids = props.orderbook?.trades0to1
            .filter((trade, tradeIndex, trades) => trades.findIndex((_trade) => _trade.amount === trade.amount) === tradeIndex)
            .sort((curr, next) => curr.ratio - next.ratio) // filter asc by obtained price
            .map(
                (trade) =>
                    [
                        trade.ratio, // 2k
                        trade.amount, // input in ETH
                        OrderbookSide.BID,
                        trade.distribution,
                        trade.ratio * trade.amount, // output in USDC
                    ] as OrderbookDataPoint,
            )
        // todo later
        // .filter((bid, bidIndex, bids) => {
        //     if (bidIndex === 0) return true
        //     return bid[0] > bids[bidIndex - 1][0]
        // })

        // example: 0 = weth, 1 = usdc
        // trades1to0 = traders swap USDC into WETH
        // so traders need WETH liquidity from LPs
        // LPs provided WETH on AMMs (= makers)
        // LPs are ready to buy USDC against WETH at a low price expressed in 1 usdc per x weth
        // LPs are ready to sell their WETH against USDC at a high price
        // They made asks to buy USDC with their WETH
        // asks
        const asks = props.orderbook?.trades1to0
            .filter((trade, tradeIndex, trades) => trades.findIndex((_trade) => _trade.amount === trade.amount) === tradeIndex)
            .map(
                (trade) =>
                    [
                        1 / trade.ratio,
                        trade.amount,
                        OrderbookSide.ASK,
                        trade.distribution,
                        trade.ratio * trade.amount, // output in USDC
                    ] as OrderbookDataPoint,
            )
            // todo later
            .sort((curr, next) => Number(curr[0]) - Number(next[0])) // filter by obtained price
        // .filter((ask, askIndex, asks) => {
        //     if (askIndex === 0) return true
        //     return ask[0] > asks[askIndex - 1][0]
        // })

        // options
        const newOptions = getOptions(
            props.orderbook.token0.symbol,
            props.orderbook.token1.symbol,
            bids,
            asks,
            props.orderbook.pools,
            yAxisType,
            yAxisLogBase,
        )

        // update
        setOptions(newOptions)

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storeRefreshedAt, yAxisType, yAxisLogBase])

    // methods
    const handlePointClick = (params: { value: undefined | OrderbookDataPoint }) => {
        if (params.value && Array.isArray(params.value))
            selectOrderbookDataPoint({ datapoint: params.value, bidsPools: props.orderbook.pools, asksPools: props.orderbook.pools })
    }

    return (
        <Suspense fallback={<CustomFallback />}>
            <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
                <ChartBackground className="relative h-[450px]">
                    {!storeRefreshedAt ? (
                        <LoadingArea message="Loading your assets" />
                    ) : Array.isArray(options.series) && options.series?.length > 0 && options.series[0].data ? (
                        <EchartWrapper
                            options={options}
                            onPointClick={(params) => {
                                toast.success(`Email copied`, { style: toastStyle })
                                handlePointClick(params as { value: undefined | OrderbookDataPoint })
                            }}
                        />
                    ) : (
                        <LoadingArea message="Contact support" />
                    )}
                </ChartBackground>
            </ErrorBoundary>
        </Suspense>
    )
}
