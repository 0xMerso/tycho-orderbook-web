'use client'

import * as echarts from 'echarts'
import { ErrorBoundary } from 'react-error-boundary'
import { Suspense, useEffect, useState } from 'react'
import { OrderbookOption, OrderbookSide } from '@/enums'
import EchartWrapper from './EchartWrapper'
import { ChartBackground, CustomFallback, LoadingArea } from './ChartsCommons'
import { useAppStore } from '@/stores/app.store'
import { APP_FONT } from '@/config/app.config'
import { ErrorBoundaryFallback } from '../common/ErrorBoundaryFallback'
import { AppColors, formatAmount } from '@/utils'
import { AmmAsOrderbook } from '@/interfaces'
import numeral from 'numeral'
import { OrderbookDataPoint } from '@/types'
import toast from 'react-hot-toast'
import { toastStyle } from '@/config/toasts.config'
import { useApiStore } from '@/stores/api.store'
type LineDataPoint = {
    value: [number, number]
    symbol?: string
    symbolSize?: number
    customData?: {
        side: OrderbookSide
        distribution: number[]
        output: number
    }
    itemStyle?: {
        borderWidth: number
        borderColor: string
        color: string
        shadowBlur: number
        shadowColor: string
    }
    emphasis?: {
        symbolSize?: number
        itemStyle?: {
            borderWidth?: number
            borderColor?: string
            color?: string
            shadowBlur?: number
            shadowColor?: string
        }
    }
}

const customSymbolPath =
    'path://M21.9583 31.4167H19.75C19.2917 31.4167 18.8993 31.2535 18.5729 30.9271C18.2465 30.6007 18.0833 30.2083 18.0833 29.75V27.5417L16.4792 25.9167C16.3264 25.75 16.2083 25.566 16.125 25.3646C16.0417 25.1632 16 24.9583 16 24.75C16 24.5417 16.0417 24.3368 16.125 24.1354C16.2083 23.934 16.3264 23.75 16.4792 23.5833L18.0833 21.9583V19.75C18.0833 19.2917 18.2465 18.8993 18.5729 18.5729C18.8993 18.2465 19.2917 18.0833 19.75 18.0833H21.9583L23.5833 16.4792C23.75 16.3264 23.934 16.2083 24.1354 16.125C24.3368 16.0417 24.5417 16 24.75 16C24.9583 16 25.1632 16.0417 25.3646 16.125C25.566 16.2083 25.75 16.3264 25.9167 16.4792L27.5417 18.0833H29.75C30.2083 18.0833 30.6007 18.2465 30.9271 18.5729C31.2535 18.8993 31.4167 19.2917 31.4167 19.75V21.9583L33.0208 23.5833C33.1736 23.75 33.2917 23.934 33.375 24.1354C33.4583 24.3368 33.5 24.5417 33.5 24.75C33.5 24.9583 33.4583 25.1632 33.375 25.3646C33.2917 25.566 33.1736 25.75 33.0208 25.9167L31.4167 27.5417V29.75C31.4167 30.2083 31.2535 30.6007 30.9271 30.9271C30.6007 31.2535 30.2083 31.4167 29.75 31.4167H27.5417L25.9167 33.0208C25.75 33.1736 25.566 33.2917 25.3646 33.375C25.1632 33.4583 24.9583 33.5 24.75 33.5C24.5417 33.5 24.3368 33.4583 24.1354 33.375C23.934 33.2917 23.75 33.1736 23.5833 33.0208L21.9583 31.4167Z'

const getOptions = (
    orderbook: AmmAsOrderbook,
    bids: LineDataPoint[],
    asks: LineDataPoint[],
    yAxisType: 'value' | 'log',
    yAxisLogBase: number,
    coloredAreas: OrderbookOption,
    symbolsInYAxis: OrderbookOption,
): echarts.EChartsOption => {
    // const sortedBids = bids.sort((curr, next) => curr.value[0] - next.value[0])
    // const sortedAsks = asks.sort((curr, next) => curr.value[0] - next.value[0])
    // const startValue = Math.min(sortedBids[Math.max(0, bids.length - 6)].value[0], sortedAsks[0].value[0])
    // const endValue = Math.max(sortedAsks[Math.min(6, asks.length - 1)].value[0], sortedBids[0].value[0])
    // console.log({ startValue, endValue })
    return {
        tooltip: {
            trigger: 'axis',
            triggerOn: 'mousemove|click',
            backgroundColor: AppColors.jagger[800],
            borderRadius: 6,
            axisPointer: {
                type: 'line',
                snap: true,
                lineStyle: {
                    color: AppColors.milk.DEFAULT,
                    width: 2,
                    type: 'dotted',
                },
            },
            borderColor: 'transparent',
            textStyle: {
                fontSize: 12,
                color: AppColors.milk.DEFAULT,
            },
            extraCssText: 'backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);',
            formatter: (params) => {
                const [firstSerieDataPoints] = Array.isArray(params) ? params : [params]

                const { value, data } = firstSerieDataPoints
                const [price, input] = value as [number, number]

                const custom = (data as LineDataPoint).customData
                const side = custom?.side
                const distribution = custom?.distribution ?? []
                const output = custom?.output ?? 0

                const distributionLines = distribution.map((percent, percentIndex) => {
                    const protocolName = orderbook.pools[percentIndex]?.protocol_system ?? 'Unknown'
                    const attributes = orderbook.pools[percentIndex]?.static_attributes ?? []
                    const hexaPercent = attributes.find((entry) => entry[0].toLowerCase() === 'fee')?.[1] ?? '0'
                    const usagePercent = numeral(percent / 100).format('0,0%')
                    const isPoolUsed = usagePercent !== '0%'
                    const poolBps = numeral(parseInt(hexaPercent, 16)).divide(100).format('0,0.[0]')
                    return `<span style="color:${isPoolUsed ? AppColors.milk[600] : AppColors.milk[200]}">- ${usagePercent} in ${protocolName} ${poolBps}bps</span>`
                    // return `<span>- ${numeral(percent / 100).format('0,0%')} in ${protocolName} ${numeral(parseInt(hexaPercent, 16)).divide(100).format('0,0.[0]')}bps</span>`
                })

                return [
                    `<strong>You sell</strong> (${side === OrderbookSide.BID ? 'left' : 'right'} Y axis)`,
                    `${numeral(input).format('0,0.[00000]')} ${side === OrderbookSide.BID ? orderbook.base.symbol : orderbook.quote.symbol}`,
                    // -
                    `<br/><strong>At price</strong> (X axis)`,
                    `1 ${orderbook.base.symbol} = ${numeral(price).format('0,0.[00000]')} ${orderbook.quote.symbol}`,
                    `1 ${orderbook.quote.symbol} = ${numeral(1 / price).format('0,0.[00000]')} ${orderbook.base.symbol}`,
                    // -
                    `<br/><strong>To buy</strong>`,
                    `${numeral(output).format('0,0.[00000]')} ${side === OrderbookSide.BID ? orderbook.quote.symbol : orderbook.base.symbol}`,
                    // -
                    `<br/><strong>Distribution</strong>`,
                    ...distributionLines,
                ]
                    .filter(Boolean)
                    .join('<br/>')
            },
        },
        toolbox: {
            top: -5,
            show: false,
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
        xAxis: {
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
            axisPointer: {
                show: true,
                label: {
                    show: true,
                    padding: [6, 10],
                    fontSize: 11,
                    borderRadius: 4,
                    formatter: (param) => {
                        const value = Number(param.value)
                        return [
                            `1 ${orderbook.base.symbol} = ${formatAmount(value)} ${orderbook.quote.symbol}`,
                            `1 ${orderbook.quote.symbol} = ${formatAmount(1 / value)} ${orderbook.base.symbol}`,
                        ].join('\n')
                    },
                    backgroundColor: AppColors.jagger[800],
                    color: AppColors.milk.DEFAULT,
                    borderColor: 'transparent',
                },
            },
        },

        // interesting: https://stackoverflow.com/questions/67622021/getting-values-instead-of-percentages-of-datazoom-in-apache-echarts
        // + this https://echarts.apache.org/en/option.html#dataZoom-slider
        dataZoom: [
            {
                xAxisIndex: 0,
                show: true,
                type: 'slider',
                height: 25,
                bottom: '3%',
                backgroundColor: AppColors.milk[50],
                fillerColor: 'transparent',
                borderColor: AppColors.milk[200],
                labelFormatter: (basePriceInQuote: number) =>
                    `${formatAmount(basePriceInQuote)} ${orderbook.quote.symbol}\n${formatAmount(1 / Number(basePriceInQuote))} ${orderbook.base.symbol}`,
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
                rangeMode: ['value', 'value'],
                // startValue,
                // endValue,
            },
            {
                xAxisIndex: 0, // make this x axis zoomable
                type: 'inside',
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
                    formatter: (value) =>
                        symbolsInYAxis === OrderbookOption.YES ? `${formatAmount(value)} ${orderbook.base.symbol}` : `${formatAmount(value)}`,
                },
                axisLine: {
                    show: false,
                },
                axisPointer: {
                    snap: true,
                },
                min: 0,
                // min: 'dataMin',
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
                    formatter: (value) =>
                        symbolsInYAxis === OrderbookOption.YES ? `${formatAmount(value)} ${orderbook.quote.symbol}` : `${formatAmount(value)}`,
                },
                axisLine: {
                    show: false,
                },
                axisPointer: {
                    snap: true,
                },
                min: 0,
                // min: 'dataMin',
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
            top: '20',
            bottom: '100',
        },

        series: [
            {
                yAxisIndex: 0,
                name: 'Bids',
                type: 'line',
                data: bids,
                // step: 'start',
                smooth: true,
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
                areaStyle:
                    coloredAreas === OrderbookOption.NO
                        ? undefined
                        : {
                              opacity: 0.3,
                              color: {
                                  type: 'linear',
                                  x: 0,
                                  y: 0,
                                  x2: 0,
                                  y2: 1,
                                  colorStops: [
                                      { offset: 0, color: AppColors.aquamarine }, // top
                                      { offset: 1, color: 'transparent' }, // bottom
                                  ],
                              },
                          },
            },
            {
                yAxisIndex: 1,
                name: 'Asks',
                type: 'line',
                data: asks,
                // step: 'end',
                smooth: true,
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
                areaStyle:
                    coloredAreas === OrderbookOption.NO
                        ? undefined
                        : {
                              opacity: 0.3,
                              color: {
                                  type: 'linear',
                                  x: 0,
                                  y: 0,
                                  x2: 0,
                                  y2: 1,
                                  colorStops: [
                                      { offset: 0, color: AppColors.folly }, // top
                                      { offset: 1, color: 'transparent' }, // bottom
                                  ],
                              },
                          },
            },
        ],
    }
}

export default function DepthChart() {
    const { buyToken, sellToken, storeRefreshedAt, yAxisType, yAxisLogBase, coloredAreas, symbolsInYAxis, selectOrderbookDataPoint } = useAppStore()
    const { apiStoreRefreshedAt, getOrderbook } = useApiStore()
    const [options, setOptions] = useState<null | echarts.EChartsOption>(null)

    // load/refresh chart
    useEffect(() => {
        const key = `${sellToken?.address}-${buyToken?.address}`
        const orderbook = getOrderbook(key)
        if (orderbook?.bids && orderbook?.asks) {
            const highestBid = orderbook.bids.reduce((max, t) => (t.average_sell_price > max.average_sell_price ? t : max), orderbook.bids[0])
            const lowestAsk = orderbook.asks.reduce((min, t) => (1 / t.average_sell_price < 1 / min.average_sell_price ? t : min), orderbook.asks[0])
            const bids: LineDataPoint[] = orderbook?.bids
                .filter((trade, tradeIndex, trades) => trades.findIndex((_trade) => _trade.amount === trade.amount) === tradeIndex)
                .sort((curr, next) => curr.average_sell_price * curr.amount - next.average_sell_price * next.amount)
                .map((trade) => {
                    const point: LineDataPoint = {
                        value: [trade.average_sell_price, trade.amount],
                        customData: {
                            side: OrderbookSide.BID,
                            distribution: trade.distribution,
                            output: trade.average_sell_price * trade.amount,
                        },
                        emphasis: {
                            symbolSize: 30,
                            itemStyle: {
                                shadowBlur: 10,
                                borderWidth: 0.5,
                                shadowColor: 'rgba(144, 238, 144, 1)',
                            },
                        },
                    }
                    if (trade === highestBid) {
                        point.symbol = customSymbolPath
                        point.symbolSize = 14
                        point.itemStyle = {
                            borderWidth: 1,
                            borderColor: AppColors.jagger[500],
                            color: AppColors.aquamarine,
                            shadowBlur: 15, // the intensity of the glow
                            shadowColor: 'rgba(144, 238, 144, 1)',
                        }
                    }
                    return point
                })
            const asks: LineDataPoint[] = orderbook?.asks
                .filter((trade, tradeIndex, trades) => trades.findIndex((_trade) => _trade.amount === trade.amount) === tradeIndex)
                .sort((curr, next) => curr.average_sell_price * curr.amount - next.average_sell_price * next.amount)
                .map((trade) => {
                    const point: LineDataPoint = {
                        value: [1 / trade.average_sell_price, trade.amount],
                        customData: {
                            side: OrderbookSide.ASK,
                            distribution: trade.distribution,
                            output: trade.average_sell_price * trade.amount,
                        },
                    }
                    if (trade === lowestAsk) {
                        point.symbol = customSymbolPath
                        point.symbolSize = 14
                        point.itemStyle = {
                            borderWidth: 1,
                            borderColor: AppColors.jagger[500],
                            color: AppColors.folly,
                            shadowBlur: 15, // the intensity of the glow
                            shadowColor: 'rgba(255, 0, 128, 1)',
                        }
                        point.emphasis = {
                            symbolSize: 30,
                            itemStyle: {
                                shadowBlur: 10,
                                shadowColor: 'rgba(255, 0, 128, 1)', // hot pink
                                borderWidth: 0.5,
                            },
                        }
                    }
                    return point
                })

            // debug
            // console.log('bids.length', bids.length, 'highestBid', highestBid.average_sell_price)
            // console.log('asks.length', asks.length, 'lowestAsk', 1 / lowestAsk.average_sell_price)

            // options
            const newOptions = getOptions(orderbook, bids, asks, yAxisType, yAxisLogBase, coloredAreas, symbolsInYAxis)

            // update
            setOptions(newOptions)
        } else {
            setOptions(null)
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sellToken?.address, buyToken?.address, apiStoreRefreshedAt, yAxisType, yAxisLogBase, coloredAreas, symbolsInYAxis])

    // methods
    const handlePointClick = (params: { value: undefined | OrderbookDataPoint }) => {
        if (params.value && Array.isArray(params.value))
            // selectOrderbookDataPoint({ datapoint: params.value, bidsPools: getOrderbook().pools, asksPools: getOrderbook().pools })
            selectOrderbookDataPoint({ datapoint: params.value, bidsPools: [], asksPools: [] })
    }

    return (
        <Suspense fallback={<CustomFallback />}>
            <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
                <ChartBackground className="relative h-[400px]">
                    {!storeRefreshedAt ? (
                        <LoadingArea />
                    ) : options && Array.isArray(options.series) && options.series?.length > 0 && options.series[0].data ? (
                        <EchartWrapper
                            options={options}
                            onPointClick={(params) => {
                                toast.success(`Trade selected`, { style: toastStyle })
                                handlePointClick(params as { value: undefined | OrderbookDataPoint })
                            }}
                        />
                    ) : (
                        <LoadingArea />
                    )}
                </ChartBackground>
            </ErrorBoundary>
        </Suspense>
    )
}
