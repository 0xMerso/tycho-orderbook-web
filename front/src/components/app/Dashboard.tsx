'use client'

import { IconIds, OrderbookOption, OrderbookAxisScale } from '@/enums'
import numeral from 'numeral'
import { useAppStore } from '@/stores/app.store'
import { ReactNode, useEffect, useRef, useState } from 'react'
import IconWrapper from '../common/IconWrapper'
import TokenImage from './TokenImage'
import ChainImage from './ChainImage'
import DepthChart from '../charts/DepthChart'
import { AmmAsOrderbook, AmmTrade, StructuredOutput, Token } from '@/interfaces'
import SelectTokenModal from './SelectTokenModal'
import { useModal } from 'connectkit'
import { useAccount } from 'wagmi'
import { useClickOutside } from '@/hooks/useClickOutside'
import { cn, fetchBalance, formatAmount } from '@/utils'
import { useQueries } from '@tanstack/react-query'
import { useApiStore } from '@/stores/api.store'
import { APP_ROUTE } from '@/config/app.config'
import toast from 'react-hot-toast'
import { toastStyle } from '@/config/toasts.config'
import LinkWrapper from '../common/LinkWrapper'

const OrderbookKeyMetric = (props: { title: string; content: ReactNode }) => (
    <OrderbookComponentLayout title={<p className="text-milk-600 text-xs">{props.title}</p>} content={props.content} />
)
const OrderbookComponentLayout = (props: { title: ReactNode; content: ReactNode }) => (
    <div className="flex flex-col w-full border rounded-xl px-4 py-3 border-milk-100 gap-1 bg-gray-600/5">
        {props.title}
        {props.content}
    </div>
)

export default function Dashboard() {
    const account = useAccount()
    const { setOpen } = useModal()
    const {
        sellToken,
        sellTokenAmountInput,
        buyToken,
        // buyTokenAmountInput,

        // options
        yAxisType,
        yAxisLogBase,
        setYAxisType,
        coloredAreas,
        setColoredAreas,
        symbolsInYAxis,
        setSymbolsInYAxis,

        // -
        switchSelectedTokens,
        setShowSelectTokenModal,
        setSelectTokenModalFor,
        setSellTokenAmountInput,
        // setBuyTokenAmountInput,
    } = useAppStore()
    const { orderBookRefreshIntervalMs, setApiTokens, setApiOrderbook, setApiStoreRefreshedAt, getOrderbook } = useApiStore()
    const [openChartOptions, showChartOptions] = useState(false)
    const [openTradeDetails, showTradeDetails] = useState(false)
    const chartOptionsDropdown = useRef<HTMLDivElement>(null)
    useClickOutside(chartOptionsDropdown, () => showChartOptions(false))
    const [buyTokenBalance, setBuyTokenBalance] = useState(-1)
    const [sellTokenBalance, setSellTokenBalance] = useState(-1)
    useEffect(() => {
        if (account.status === 'connected' && account.address && account.chainId) {
            if (buyToken?.address)
                fetchBalance(account.address, account.chainId, buyToken.address as `0x${string}`).then((balance) =>
                    setBuyTokenBalance(isNaN(balance) ? -1 : balance),
                )
            if (sellToken?.address)
                fetchBalance(account.address, account.chainId, sellToken.address as `0x${string}`).then((balance) =>
                    setSellTokenBalance(isNaN(balance) ? -1 : balance),
                )
        }
    }, [account.address, account.chainId, account.status, buyToken?.address, sellToken?.address])

    // load data from rust api
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_, ApiOrderbookQuery] = useQueries({
        queries: [
            // todo status query to update when the api is ready
            {
                queryKey: ['ApiTokensQuery'],
                enabled: true,
                queryFn: async () => {
                    // fetch
                    // toast(`Refreshing tokens list...`, { style: toastStyle })
                    const [tokensResponse] = await Promise.all([
                        fetch(`${APP_ROUTE}/api/local/tokens`, { method: 'GET', headers: { 'Content-Type': 'application/json' } }),
                    ])

                    // parse
                    const [tokensResponseJson] = (await Promise.all([tokensResponse.json()])) as [StructuredOutput<Token[]>]

                    // store
                    if (tokensResponseJson?.data) {
                        setApiTokens(tokensResponseJson.data)
                        // toast.success(`Tokens list loaded`, { style: toastStyle })
                    }

                    // finally
                    return { tokensResponseJson }
                },
                refetchOnWindowFocus: false,
                refetchInterval: 1000 * 60 * 5,
            },
            {
                queryKey: ['ApiOrderbookQuery', sellToken?.address, buyToken?.address],
                enabled: true,
                queryFn: async () => {
                    if (!sellToken?.address || !buyToken?.address) return null

                    // toast(`Refreshing ${sellToken.symbol}-${buyToken.symbol} orderbook data...`, { style: toastStyle })
                    const url = `${APP_ROUTE}/api/local/orderbook?token0=${sellToken.address}&token1=${buyToken.address}`
                    const [response] = await Promise.all([fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } })])
                    const [responseJson] = (await Promise.all([response.json()])) as [StructuredOutput<AmmAsOrderbook>]
                    const pair = `${sellToken.address}-${buyToken.address}`

                    // handle errors
                    if (responseJson.error) {
                        if (responseJson.error.includes('pair has 0 associated components'))
                            toast.error(`No pool for pair ${sellToken.symbol}-${buyToken.symbol} > select another pair`, { style: toastStyle })
                        else toast.error(`${responseJson.error}`, { style: toastStyle })
                    }

                    // handle errors
                    else if (!responseJson.data?.bids || !responseJson.data?.asks) {
                        toast.error(`Bad orderbook format`, { style: toastStyle })
                    }

                    // handle success
                    else if (responseJson.data) {
                        setApiOrderbook(pair, responseJson.data)
                        toast.success(`Latest ${sellToken.symbol}-${buyToken.symbol} orderbook data loaded`, { style: toastStyle })
                        setApiStoreRefreshedAt(Date.now())
                        if (responseJson.data.bids) {
                            const highestBid = responseJson.data.bids.reduce(
                                (max, t) => (t.average_sell_price > max.average_sell_price ? t : max),
                                responseJson.data.bids[0],
                            )
                            if (highestBid) setSellTokenAmountInput(highestBid.amount)
                        }
                    }

                    // -
                    return { responseJson }
                },
                refetchOnWindowFocus: false,
                refetchInterval: orderBookRefreshIntervalMs,
            },
        ],
    })

    useEffect(() => {
        if (!ApiOrderbookQuery.isFetching || !ApiOrderbookQuery.isLoading) ApiOrderbookQuery.refetch()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sellToken, buyToken])

    // prepare
    const metrics:
        | {
              showOrderbookPlaceholders: boolean
              orderbook?: AmmAsOrderbook
              highestBid?: AmmTrade
              lowestAsk?: AmmTrade
              midPrice: number
              totalBaseAmountInPools: number
              totalQuoteAmountInPools: number
              totalBaseTvlUsd: number
              totalQuoteTvlUsd: number
          }
        | {
              showOrderbookPlaceholders: boolean
              orderbook: AmmAsOrderbook
              highestBid: AmmTrade
              lowestAsk: AmmTrade
              midPrice: number
              totalBaseAmountInPools: number
              totalQuoteAmountInPools: number
              totalBaseTvlUsd: number
              totalQuoteTvlUsd: number
          } = {
        showOrderbookPlaceholders: true,
        highestBid: undefined,
        lowestAsk: undefined,
        midPrice: -1,
        totalBaseAmountInPools: -1,
        totalQuoteAmountInPools: -1,
        totalBaseTvlUsd: -1,
        totalQuoteTvlUsd: -1,
    }

    // ensure sell / buy are defined
    if (sellToken && buyToken) {
        const key = `${sellToken.address}-${buyToken.address}`

        // ensure orderbook is loaded
        metrics.orderbook = getOrderbook(key)
        if (metrics.orderbook?.bids && metrics.orderbook?.asks && metrics.orderbook?.base_lqdty && metrics.orderbook?.quote_lqdty) {
            metrics.highestBid = metrics.orderbook.bids.reduce(
                (max, t) => (t.average_sell_price > max.average_sell_price ? t : max),
                metrics.orderbook.bids[0],
            )
            metrics.lowestAsk = metrics.orderbook.asks.reduce(
                (min, t) => (t.average_sell_price > min.average_sell_price ? t : min),
                metrics.orderbook.asks[0],
            )
            metrics.midPrice = (metrics.highestBid.average_sell_price + 1 / metrics.lowestAsk.average_sell_price) / 2
            metrics.totalBaseAmountInPools = metrics.orderbook.base_lqdty.reduce((total, baseAmountInPool) => (total += baseAmountInPool), 0)
            metrics.totalQuoteAmountInPools = metrics.orderbook.quote_lqdty.reduce((total, quoteAmountInPool) => (total += quoteAmountInPool), 0)
            metrics.totalBaseTvlUsd = metrics.totalBaseAmountInPools * metrics.orderbook.base_worth_eth * metrics.orderbook.eth_usd
            metrics.totalQuoteTvlUsd = metrics.totalQuoteAmountInPools * metrics.orderbook.quote_worth_eth * metrics.orderbook.eth_usd

            // -
            metrics.showOrderbookPlaceholders = false
        }
    }

    return (
        <div className="w-full grid grid-cols-1 md:grid-cols-11 gap-4">
            {/* left */}
            <div className="col-span-1 md:col-span-7 flex flex-col gap-4">
                {/* metrics */}
                <div className="w-full grid grid-cols-2 md:grid-cols-3 gap-2">
                    {/* bid */}
                    {!metrics.showOrderbookPlaceholders && sellToken?.symbol && buyToken?.symbol && metrics.highestBid ? (
                        <OrderbookComponentLayout
                            title={
                                <div className="w-full flex items-start gap-1 group">
                                    <p className="text-milk-600 text-xs">Best bid</p>
                                    <IconWrapper icon={IconIds.INFORMATION} className="size-3.5 text-milk-200 group-hover:text-milk cursor-pointer" />
                                </div>
                            }
                            content={
                                <div className="flex gap-1.5 items-center flex-wrap">
                                    <TokenImage size={20} token={buyToken} />
                                    <p className="text-milk font-bold text-base">{formatAmount(metrics.highestBid.average_sell_price)}</p>
                                </div>
                            }
                        />
                    ) : (
                        <OrderbookComponentLayout
                            title={
                                <div className="w-full flex items-start gap-1 group">
                                    <p className="text-milk-600 text-xs">Best bid</p>
                                    <IconWrapper icon={IconIds.INFORMATION} className="size-3.5 text-milk-200 group-hover:text-milk cursor-pointer" />
                                </div>
                            }
                            content={
                                <div className="flex gap-1.5 items-center flex-wrap skeleton-loading p-1">
                                    <span className="animate-pulse rounded-full bg-milk-150" style={{ width: 20, height: 20 }} />
                                </div>
                            }
                        />
                    )}

                    {/* mid price */}
                    {!metrics.showOrderbookPlaceholders && sellToken?.symbol && buyToken?.symbol && metrics.midPrice ? (
                        <OrderbookComponentLayout
                            title={
                                <div className="w-full flex items-start gap-1 group">
                                    <p className="text-milk-600 text-xs">Mid-price</p>
                                    <IconWrapper icon={IconIds.INFORMATION} className="size-3.5 text-milk-200 group-hover:text-milk cursor-pointer" />
                                </div>
                            }
                            content={
                                <div className="flex gap-1.5 items-center flex-wrap">
                                    <TokenImage size={20} token={buyToken} />
                                    <p className="text-milk font-bold text-base">{formatAmount(metrics.midPrice)}</p>
                                </div>
                            }
                        />
                    ) : (
                        <OrderbookKeyMetric
                            title="Mid-price"
                            content={
                                <div className="flex gap-1.5 items-center flex-wrap skeleton-loading p-1">
                                    <span className="animate-pulse rounded-full bg-milk-150" style={{ width: 20, height: 20 }} />
                                </div>
                            }
                        />
                    )}

                    {/* ask */}
                    {!metrics.showOrderbookPlaceholders && sellToken?.symbol && buyToken?.symbol && metrics.lowestAsk ? (
                        <OrderbookComponentLayout
                            title={
                                <div className="w-full flex items-start gap-1 group">
                                    <p className="text-milk-600 text-xs">Best ask</p>
                                    <IconWrapper icon={IconIds.INFORMATION} className="size-3.5 text-milk-200 group-hover:text-milk cursor-pointer" />
                                </div>
                            }
                            content={
                                <div className="flex gap-1.5 items-center flex-wrap">
                                    <TokenImage size={20} token={buyToken} />
                                    <p className="text-milk font-bold text-base">{formatAmount(1 / metrics.lowestAsk.average_sell_price)}</p>
                                </div>
                            }
                        />
                    ) : (
                        <OrderbookKeyMetric
                            title="Best ask"
                            content={
                                <div className="flex gap-1.5 items-center flex-wrap skeleton-loading p-1">
                                    <span className="animate-pulse rounded-full bg-milk-150" style={{ width: 20, height: 20 }} />
                                </div>
                            }
                        />
                    )}

                    {/* spread */}
                    {!metrics.showOrderbookPlaceholders &&
                    sellToken?.symbol &&
                    buyToken?.symbol &&
                    metrics.lowestAsk &&
                    metrics.highestBid &&
                    metrics.midPrice ? (
                        <OrderbookKeyMetric
                            title="Spread"
                            content={
                                <p className="text-milk font-bold text-base">
                                    {numeral(
                                        (1 / metrics.lowestAsk.average_sell_price - metrics.highestBid.average_sell_price) / metrics.midPrice,
                                    ).format('0,0.[0000]%')}{' '}
                                    <span className="pl-1 text-milk-400 text-xs">
                                        {numeral(
                                            (1 / metrics.lowestAsk.average_sell_price - metrics.highestBid.average_sell_price) / metrics.midPrice,
                                        )
                                            .multiply(10000)
                                            .format('0,0.[00]')}{' '}
                                        bps
                                    </span>
                                </p>
                            }
                        />
                    ) : (
                        <OrderbookKeyMetric
                            title="Spread"
                            content={
                                <div className="flex gap-1.5 items-center flex-wrap skeleton-loading p-1">
                                    <p className="text-milk-100 font-bold text-sm">0.00%</p>
                                </div>
                            }
                        />
                    )}

                    {/* last block */}
                    {!metrics.showOrderbookPlaceholders && sellToken?.symbol && buyToken?.symbol && metrics.orderbook ? (
                        <OrderbookComponentLayout
                            title={
                                <div className="w-full flex justify-between">
                                    <p className="text-milk-600 text-xs">Last block</p>
                                    <p className="text-milk-600 text-xs">3s</p>
                                </div>
                            }
                            content={
                                <LinkWrapper
                                    target="_blank"
                                    href={`https://etherscan.io/block/${metrics.orderbook.block}`}
                                    className="flex gap-1 items-center group"
                                >
                                    <p className="text-milk font-bold text-base">{numeral(metrics.orderbook.block).format('0,0')}</p>
                                    <IconWrapper icon={IconIds.OPEN_LINK_IN_NEW_TAB} className="size-4 text-milk-200 group-hover:text-milk" />
                                </LinkWrapper>
                            }
                        />
                    ) : (
                        <OrderbookKeyMetric
                            title="Last block"
                            content={
                                <div className="flex gap-1.5 items-center flex-wrap skeleton-loading p-1">
                                    <p className="text-milk-100 font-bold text-sm">123456789</p>
                                </div>
                            }
                        />
                    )}

                    {/* TVL */}
                    {!metrics.showOrderbookPlaceholders &&
                    sellToken?.symbol &&
                    buyToken?.symbol &&
                    metrics.totalBaseTvlUsd &&
                    metrics.totalQuoteTvlUsd ? (
                        <OrderbookKeyMetric
                            title="Total TVL"
                            content={
                                <p className="text-milk font-bold text-base">$ {formatAmount(metrics.totalBaseTvlUsd + metrics.totalQuoteTvlUsd)}</p>
                            }
                        />
                    ) : (
                        <OrderbookKeyMetric
                            title="Total TVL"
                            content={
                                <div className="flex gap-1.5 items-center flex-wrap skeleton-loading p-1 w-full">
                                    <p className="text-milk-100 font-bold text-sm">$ 100m</p>
                                </div>
                            }
                        />
                    )}
                </div>

                <OrderbookComponentLayout
                    title={
                        <div className="w-full flex justify-between">
                            {/* title */}
                            <p className="text-milk text-base font-bold">Market depth</p>
                            <button onClick={() => showChartOptions(!openChartOptions)} className="relative">
                                <div className="flex items-center gap-1 hover:bg-milk-100/5 transition-colors duration-300 rounded-lg px-2.5 py-1.5">
                                    <p className="text-milk text-sm">Options</p>
                                    <IconWrapper icon={IconIds.TRIANGLE_DOWN} className="size-4" />
                                </div>

                                {/* options dropdown */}
                                <div
                                    ref={chartOptionsDropdown}
                                    className={cn(
                                        `z-20 absolute mt-2 w-52 rounded-2xl backdrop-blur-lg border border-milk-150 shadow-lg p-2.5 transition-all origin-top-left flex flex-col gap-5`,
                                        {
                                            'scale-100 opacity-100': openChartOptions,
                                            'scale-95 opacity-0 pointer-events-none': !openChartOptions,
                                        },
                                    )}
                                >
                                    {/* option */}
                                    <div className="flex flex-col w-full items-start gap-0.5">
                                        <p className="text-milk-400 text-sm font-bold">Y Axis scale</p>
                                        <div className="grid grid-cols-2 w-full">
                                            {[OrderbookAxisScale.VALUE, OrderbookAxisScale.LOG].map((type, typeIndex) => (
                                                <div
                                                    key={`${type}-${typeIndex}`}
                                                    className={cn('flex items-center gap-2 w-full px-4 py-1.5 rounded-lg transition', {
                                                        'text-white bg-gray-600/20': yAxisType === type,
                                                        'text-milk-400 hover:bg-gray-600/20': yAxisType !== type,
                                                    })}
                                                    onClick={() => setYAxisType(type)}
                                                >
                                                    <p className="text-sm mx-auto">
                                                        {type === OrderbookAxisScale.VALUE ? 'Linear' : `Log ${yAxisLogBase}`}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* option */}
                                    <div className="flex flex-col w-full items-start gap-0.5">
                                        <p className="text-milk-400 text-sm font-bold">Colored areas</p>
                                        <div className="grid grid-cols-2 w-full">
                                            {[OrderbookOption.YES, OrderbookOption.NO].map((option, optionIndex) => (
                                                <div
                                                    key={`${option}-${optionIndex}`}
                                                    className={cn('flex items-center gap-2 w-full px-4 py-1.5 rounded-lg transition', {
                                                        'text-white bg-gray-600/20': coloredAreas === option,
                                                        'text-milk-400 hover:bg-gray-600/20': coloredAreas !== option,
                                                    })}
                                                    onClick={() =>
                                                        setColoredAreas(
                                                            coloredAreas === OrderbookOption.YES ? OrderbookOption.NO : OrderbookOption.YES,
                                                        )
                                                    }
                                                >
                                                    <p className="text-sm mx-auto">{option}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* titles */}
                                    <div className="flex flex-col w-full items-start gap-0.5">
                                        <p className="text-milk-400 text-sm font-bold">Symbols in Y axis labels</p>
                                        <div className="grid grid-cols-2 w-full">
                                            {[OrderbookOption.YES, OrderbookOption.NO].map((option, optionIndex) => (
                                                <div
                                                    key={`${option}-${optionIndex}`}
                                                    className={cn('flex items-center gap-2 w-full px-4 py-1.5 rounded-lg transition', {
                                                        'text-white bg-gray-600/20': symbolsInYAxis === option,
                                                        'text-milk-400 hover:bg-gray-600/20': symbolsInYAxis !== option,
                                                    })}
                                                    onClick={() =>
                                                        setSymbolsInYAxis(
                                                            symbolsInYAxis === OrderbookOption.YES ? OrderbookOption.NO : OrderbookOption.YES,
                                                        )
                                                    }
                                                >
                                                    <p className="text-sm mx-auto">{option}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        </div>
                    }
                    content={<DepthChart />}
                />

                {/* routes */}
                <OrderbookComponentLayout title={<p className="text-milk text-base font-bold">Routing</p>} content={undefined} />
            </div>

            {/* right */}
            <div className="col-span-1 md:col-span-4 flex flex-col gap-0.5">
                {/* sell */}
                <div
                    className={cn('flex flex-col gap-1 p-4 rounded-xl border-milk-150 w-full', {
                        'bg-folly/20': account.isConnected && sellToken?.address && sellTokenAmountInput && sellTokenBalance < sellTokenAmountInput,
                        'bg-milk-600/5': !(
                            account.isConnected &&
                            sellToken?.address &&
                            sellTokenAmountInput &&
                            sellTokenBalance < sellTokenAmountInput
                        ),
                    })}
                >
                    <div className="flex justify-between">
                        <p className="text-milk-600 text-xs">Sell</p>
                        <div className="flex items-center">
                            {account.isConnected && sellToken?.address && sellTokenBalance < Number(sellTokenAmountInput) ? (
                                <button onClick={() => setSellTokenAmountInput(sellTokenBalance)} className="pr-1">
                                    <p className="text-folly font-bold text-xs">Exceeds Balance</p>
                                </button>
                            ) : null}
                            <button
                                onClick={() => {}}
                                className={cn('flex transition-colors duration-300 opacity-80 px-2.5 py-1.5 rounded-lg', {
                                    'bg-milk-100/5': true,
                                    'hover:opacity-100 hover:bg-milk-100/5': false,
                                })}
                            >
                                <p className="font-bold text-aquamarine text-xs">Best bid</p>
                            </button>
                        </div>
                    </div>
                    <div className="flex justify-between gap-3">
                        <button
                            onClick={() => {
                                setSelectTokenModalFor('sell')
                                setShowSelectTokenModal(true)
                            }}
                            className="flex rounded-full bg-gray-600/30 transition-colors duration-300 hover:bg-gray-600/50 items-center gap-1.5 pl-1.5 pr-2 py-1.5 min-w-fit"
                        >
                            {sellToken ? (
                                <TokenImage size={24} token={sellToken} />
                            ) : (
                                <span className="animate-pulse rounded-full bg-milk-150" style={{ width: 24, height: 24 }} />
                            )}
                            {sellToken ? (
                                <p className="font-semibold tracking-wide">{sellToken.symbol}</p>
                            ) : (
                                <div className="skeleton-loading flex w-16 h-6 items-center justify-center rounded-full" />
                            )}
                            <IconWrapper icon={IconIds.TRIANGLE_DOWN} className="size-4" />
                        </button>
                        <input
                            type="text"
                            className="text-xl font-bold text-right border-none outline-none ring-0 focus:ring-0 focus:outline-none focus:border-none bg-transparent w-40"
                            value={numeral(sellTokenAmountInput).format('0,0.[00000]')}
                            onChange={(e) => {
                                const parsedNumber = Number(numeral(e.target.value).value())
                                if (isNaN(parsedNumber)) return
                                setSellTokenAmountInput(parsedNumber)
                            }}
                        />
                    </div>
                    {metrics.highestBid && metrics.orderbook ? (
                        <div className="mt-2 flex justify-between items-center">
                            <div className="flex justify-between gap-1 items-center">
                                <IconWrapper icon={IconIds.WALLET} className="size-4 text-milk-400" />
                                <p className="text-milk-400 text-xs">
                                    {account.isConnected && sellTokenBalance >= 0 ? formatAmount(sellTokenBalance) : 0}
                                </p>
                                {account.isConnected && sellToken?.address && (
                                    <button onClick={() => setSellTokenAmountInput(sellTokenBalance)} className="pl-1">
                                        <p className="text-folly font-bold text-xs">MAX</p>
                                    </button>
                                )}
                            </div>
                            <p className="text-milk-600 text-xs">
                                ${' '}
                                {numeral(metrics.highestBid.amount * metrics.orderbook.eth_usd * metrics.orderbook.base_worth_eth).format('0,0.[00]')}
                            </p>
                        </div>
                    ) : (
                        <div className="mt-2 flex justify-between items-center">
                            <div className="flex justify-between gap-1 items-center">
                                <IconWrapper icon={IconIds.WALLET} className="size-4 text-milk-400" />
                                <p className="text-milk-400 text-xs">
                                    {account.isConnected && buyTokenBalance >= 0 ? formatAmount(buyTokenBalance) : 0}
                                </p>
                            </div>
                            <div className="skeleton-loading w-16 h-4 rounded-full" />
                        </div>
                    )}
                </div>

                {/* arrow */}
                <div className="h-0 w-full flex justify-center items-center z-10">
                    <div className="size-[44px] rounded-xl bg-background p-1">
                        <button
                            onClick={() => {
                                if (!metrics.showOrderbookPlaceholders) switchSelectedTokens()
                                // do nothing
                            }}
                            className={cn('size-full rounded-lg bg-milk-600/5 flex items-center justify-center', {
                                'cursor-not-allowed': metrics.showOrderbookPlaceholders,
                                group: !metrics.showOrderbookPlaceholders,
                            })}
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
                            {buyToken ? (
                                <TokenImage size={24} token={buyToken} />
                            ) : (
                                <span className="animate-pulse rounded-full bg-milk-150" style={{ width: 24, height: 24 }} />
                            )}
                            {buyToken ? (
                                <p className="font-semibold tracking-wide">{buyToken.symbol}</p>
                            ) : (
                                <div className="skeleton-loading flex w-16 h-6 items-center justify-center rounded-full" />
                            )}
                            <IconWrapper icon={IconIds.TRIANGLE_DOWN} className="size-4" />
                        </button>
                        <p className="text-xl font-bold text-right border-none outline-none ring-0 focus:ring-0 focus:outline-none focus:border-none bg-transparent w-40 cursor-not-allowed">
                            {numeral(metrics?.highestBid?.output ?? 0).format('0,0.[00000]')}
                        </p>
                        {/* <input
                            type="text"
                            className="text-xl font-bold text-right border-none outline-none ring-0 focus:ring-0 focus:outline-none focus:border-none bg-transparent w-40 cursor-not-allowed"
                            value={numeral(metrics?.highestBid?.output ?? 0).format('0,0.[00000]')} // todo load trade here
                            // onChange={(e) => {
                            //     const parsedNumber = Number(numeral(e.target.value ?? 0).value())
                            //     if (isNaN(parsedNumber)) return
                            //     setBuyTokenAmountInput(parsedNumber)
                            // }}
                        /> */}
                    </div>

                    {metrics.highestBid && metrics.orderbook ? (
                        <div className="flex justify-between items-center">
                            <div className="flex justify-between gap-1 items-center">
                                <IconWrapper icon={IconIds.WALLET} className="size-4 text-milk-400" />
                                <p className="text-milk-400 text-xs">
                                    {account.isConnected && sellTokenBalance >= 0 ? formatAmount(sellTokenBalance) : 0}
                                </p>
                            </div>
                            <p className="text-milk-600 text-xs">
                                ${' '}
                                {numeral(metrics.highestBid.output * metrics.orderbook.eth_usd * metrics.orderbook.quote_worth_eth).format(
                                    '0,0.[00]',
                                )}
                            </p>
                        </div>
                    ) : (
                        <div className="mt-2 flex justify-between items-center">
                            <div className="flex justify-between gap-1 items-center">
                                <IconWrapper icon={IconIds.WALLET} className="size-4 text-milk-400" />
                                <p className="text-milk-400 text-xs">
                                    {account.isConnected && sellTokenBalance >= 0 ? formatAmount(sellTokenBalance) : 0}
                                </p>
                            </div>
                            <div className="skeleton-loading w-16 h-4 rounded-full" />
                        </div>
                    )}
                </div>

                {/* separator */}
                <div className="h-0 w-full" />

                {/* fees */}
                <div className="bg-milk-600/5 flex flex-col gap-6 px-2 py-4 rounded-xl border-milk-150 text-xs">
                    {/* summary */}
                    <div className="flex w-full justify-between items-center">
                        {sellToken && buyToken && metrics.highestBid && metrics.orderbook ? (
                            <p className="text-milk-600 truncate pl-2">
                                1 {sellToken.symbol} = {formatAmount((1 / metrics.highestBid.amount) * metrics.highestBid.output)} {buyToken.symbol}{' '}
                                (${' '}
                                {formatAmount(
                                    (1 / metrics.highestBid.amount) *
                                        metrics.highestBid.output *
                                        metrics.orderbook.eth_usd *
                                        metrics.orderbook.quote_worth_eth,
                                )}
                                )
                            </p>
                        ) : sellToken && buyToken ? (
                            <div className="flex items-center gap-1">
                                <p className="text-milk-600 truncate pl-2">1 {sellToken.symbol} =</p>
                                <div className="skeleton-loading flex w-12 h-4 items-center justify-center rounded-full" />
                                <p className="text-milk-600 truncate">{buyToken.symbol}</p>
                            </div>
                        ) : (
                            <div className="skeleton-loading flex w-20 h-4 items-center justify-center rounded-full" />
                        )}

                        <button
                            onClick={() => showTradeDetails(!openTradeDetails)}
                            className="flex gap-1.5 items-center hover:bg-milk-100/5 px-2 py-1 rounded-xl"
                        >
                            <IconWrapper icon={IconIds.GAS} className="size-4 text-milk-600" />
                            <ChainImage networkName="ethereum" className="size-4" />
                            <p className="text-milk-600">
                                ${' '}
                                {metrics.highestBid?.gas_costs_usd
                                    ? numeral(metrics.highestBid.gas_costs_usd.reduce((cost, curr) => (cost += curr), 0)).format('0,0.[00]')
                                    : '-'}
                            </p>
                            <IconWrapper
                                icon={openTradeDetails ? IconIds.TRIANGLE_UP : IconIds.TRIANGLE_DOWN}
                                className="size-4 transition-transform duration-300"
                            />
                        </button>
                    </div>

                    {/* details */}
                    {openTradeDetails && (
                        <div className="flex flex-col gap-2 text-xs px-2">
                            <div className="flex justify-between w-full text-milk-400">
                                <p>Expected output</p>
                                <div className="skeleton-loading w-16 h-4 rounded-full" />
                            </div>
                            <div className="flex justify-between w-full text-milk-400">
                                <p>Minimum received after slippage (0.2%)</p>
                                <div className="skeleton-loading w-16 h-4 rounded-full" />
                            </div>
                            <div className="flex justify-between w-full text-milk-400">
                                <p>Price Impact</p>
                                <div className="skeleton-loading w-16 h-4 rounded-full" />
                            </div>
                            <div className="flex justify-between w-full text-milk-400">
                                <p>Gas token</p>
                                <div className="flex gap-1 items-center">
                                    {sellToken ? (
                                        <TokenImage size={16} token={sellToken} />
                                    ) : (
                                        <span className="animate-pulse rounded-full bg-milk-150" style={{ width: 16, height: 16 }} />
                                    )}
                                    {sellToken ? (
                                        <p className="font-semibold tracking-wide">{sellToken.symbol}</p>
                                    ) : (
                                        <div className="skeleton-loading flex w-16 h-6 items-center justify-center rounded-full" />
                                    )}
                                </div>
                            </div>
                            <div className="flex justify-between w-full text-milk-400">
                                <p>Network Fee</p>
                                <div className="skeleton-loading w-16 h-4 rounded-full" />
                            </div>
                        </div>
                    )}
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
