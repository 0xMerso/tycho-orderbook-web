'use client'

import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcutArgs'
import { motion } from 'framer-motion'
import { IconIds } from '@/enums'
import IconWrapper from '../common/IconWrapper'
import { Backdrop } from '../common/Backdrop'
import { useEffect, useRef } from 'react'
import { useClickOutside } from '@/hooks/useClickOutside'
import { useAppStore } from '@/stores/app.store'
import { cn, shortenAddress, sleep } from '@/utils'
import TokenImage from './TokenImage'
import { hardcodedTokensList } from '@/data/back-tokens'
import { useAccount } from 'wagmi'
import { useApiStore } from '@/stores/api.store'

export default function SelectTokenModal() {
    const {
        sellToken,
        buyToken,
        showSelectTokenModal,
        selectTokenModalFor,
        selectTokenModalSearch,
        selectSellToken,
        selectBuyToken,
        setShowSelectTokenModal,
        setSelectTokenModalSearch,
    } = useAppStore()
    const { apiTokens } = useApiStore()
    const account = useAccount()
    const modalRef = useRef<HTMLDivElement>(null)
    const searchInput = useRef<HTMLInputElement>(null)
    useEffect(() => searchInput.current?.focus(), [showSelectTokenModal])
    useKeyboardShortcut({ key: 'Escape', onKeyPressed: () => setShowSelectTokenModal(false) })
    useClickOutside(modalRef, () => setShowSelectTokenModal(false))
    const tokensList = apiTokens.length ? apiTokens : hardcodedTokensList
    if (!showSelectTokenModal) return null
    return (
        <Backdrop>
            <motion.div
                ref={modalRef}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ ease: 'easeInOut', duration: 0.25 }}
                className="flex max-w-[430px] w-full flex-col rounded-xl border border-milk-150 bg-jagger/80 shadow-lg"
            >
                {/* 1 header */}
                <div className="p-4 flex w-full items-center justify-between focus:ring-2 focus:ring-folly focus:ring-offset-2 cursor-pointer">
                    <p className="font-semibold text-xl">Select a token</p>
                    <button
                        onClick={() => setShowSelectTokenModal(false)}
                        className="rounded-xl hover:bg-very-light-hover hover:text-milk-600 focus:outline-none p-2 transition-colors duration-300"
                    >
                        <IconWrapper icon={IconIds.CLOSE} className="size-6" />
                    </button>
                </div>

                {/* 2 search */}
                <div className="px-4 pb-4 w-full">
                    <div className="flex w-full items-center rounded-lg border border-milk-200 transition focus-within:ring-2 focus-within:ring-folly">
                        <IconWrapper icon={IconIds.SEARCH} className="size-[22px] text-milk-600 ml-2 mr-3 my-2" />
                        <input
                            ref={searchInput}
                            value={selectTokenModalSearch}
                            onChange={(e) => setSelectTokenModalSearch(e.target.value)}
                            type="text"
                            className="text-base font-light text-milk-600 grow bg-transparent outline-none placeholder:text-milk-400"
                            placeholder="Search a name or paste address"
                        />
                        {selectTokenModalSearch && (
                            <button onClick={() => setSelectTokenModalSearch('')} className="px-1.5">
                                <IconWrapper icon={IconIds.CLOSE} className="size-7 text-milk-600" />
                            </button>
                        )}
                    </div>
                </div>

                {/* suggestions */}
                <div className="px-4 flex flex-wrap gap-2">
                    {[sellToken, buyToken, ...tokensList.slice(0, 7)]
                        .filter((token) => !!token)
                        .filter((token, tokenIndex, tokens) => tokens.findIndex((_t) => _t?.address === token.address) === tokenIndex)
                        .sort(
                            (curr, next) =>
                                tokensList.findIndex((_t) => _t.address === curr.address) - tokensList.findIndex((_t) => _t.address === next.address),
                        )
                        .map((token) => (
                            <button
                                key={token.symbol}
                                onClick={async () => {
                                    if (selectTokenModalFor === 'buy') selectBuyToken(token)
                                    else selectSellToken(token)
                                    await sleep(200)
                                    setShowSelectTokenModal(false)
                                }}
                                disabled={token.address === (selectTokenModalFor === 'buy' ? sellToken?.address : buyToken?.address)}
                                className={cn('flex gap-2 border border-milk-200 py-2.5 px-3 rounded-lg items-center', {
                                    'border-folly': [
                                        selectTokenModalFor === 'buy' ? buyToken?.symbol.toLowerCase() : sellToken?.symbol.toLowerCase(),
                                    ].includes(token.symbol.toLowerCase()),
                                    'opacity-30 cursor-not-allowed':
                                        token.address === (selectTokenModalFor === 'buy' ? sellToken?.address : buyToken?.address),
                                })}
                            >
                                <TokenImage token={token} size={20} className="size-fit h-5" />
                                <p className="text-milk text-sm">{token.symbol.toUpperCase()}</p>
                            </button>
                        ))}
                </div>

                {/* tokens */}
                <div className="px-3 max-h-[400px] overflow-scroll flex flex-col border-t border-milk-150 mt-4">
                    {account.isConnected && (
                        <>
                            <p className="p-4 text-base text-milk-400">Your tokens</p>
                            {tokensList
                                .slice(0, 3)
                                .filter((token) => token.symbol.toLowerCase().includes(selectTokenModalSearch.toLowerCase()))
                                .map((token, tokenIndex) => (
                                    <button
                                        key={`${token}-${tokenIndex}`}
                                        onClick={async () => {
                                            if (selectTokenModalFor === 'buy') {
                                                if (buyToken?.address === token.address) return
                                                selectBuyToken(token)
                                            } else {
                                                if (sellToken?.address === token.address) return
                                                selectSellToken(token)
                                            }
                                            await sleep(200)
                                            setShowSelectTokenModal(false)
                                        }}
                                        disabled={token.address === (selectTokenModalFor === 'buy' ? sellToken?.address : buyToken?.address)}
                                        className={cn(
                                            'px-2.5 py-2 rounded-xl flex justify-between hover:bg-very-light-hover group hover:bg-milk-600/5',
                                            {
                                                'bg-milk-600/5': [
                                                    selectTokenModalFor === 'buy' ? buyToken?.symbol.toLowerCase() : sellToken?.symbol.toLowerCase(),
                                                ].includes(token.symbol.toLowerCase()),
                                                'opacity-30 cursor-not-allowed':
                                                    token.address === (selectTokenModalFor === 'buy' ? sellToken?.address : buyToken?.address),
                                            },
                                        )}
                                    >
                                        <div className="flex items-center gap-4">
                                            <TokenImage token={token} size={36} className="size-fit h-9" />
                                            <div className="flex flex-col items-start">
                                                <p className="text-sm text-milk">{token.symbol.toUpperCase()}</p>
                                                <p className="text-xs text-milk-400">{shortenAddress(token.address)}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <p className="text-sm text-milk">0.000000</p>
                                            <p className="text-xs text-milk-400">$0.00</p>
                                        </div>
                                    </button>
                                ))}
                        </>
                    )}

                    <p className="p-4 text-base text-milk-400">Popular tokens</p>
                    {tokensList
                        // .filter((token) => token.address !== (selectTokenModalFor === 'buy' ? sellToken?.address : buyToken?.address))
                        .slice(account.isConnected ? 3 : 0, 200)
                        .filter((token) => token.symbol.toLowerCase().includes(selectTokenModalSearch.toLowerCase()))
                        .map((token, tokenIndex) => (
                            <button
                                key={`${token}-${tokenIndex}`}
                                onClick={async () => {
                                    if (selectTokenModalFor === 'buy') {
                                        if (buyToken?.address === token.address) return
                                        selectBuyToken(token)
                                    } else {
                                        if (sellToken?.address === token.address) return
                                        selectSellToken(token)
                                    }
                                    await sleep(200)
                                    setShowSelectTokenModal(false)
                                }}
                                disabled={token.address === (selectTokenModalFor === 'buy' ? sellToken?.address : buyToken?.address)}
                                className={cn('px-2.5 py-2 rounded-xl flex justify-between hover:bg-very-light-hover group hover:bg-milk-600/5', {
                                    'bg-milk-600/5': [
                                        selectTokenModalFor === 'buy' ? buyToken?.symbol.toLowerCase() : sellToken?.symbol.toLowerCase(),
                                    ].includes(token.symbol.toLowerCase()),
                                    'opacity-30 cursor-not-allowed':
                                        token.address === (selectTokenModalFor === 'buy' ? sellToken?.address : buyToken?.address),
                                })}
                            >
                                <div className="flex items-center gap-4">
                                    <TokenImage token={token} size={36} className="size-fit h-9" />
                                    <div className="flex flex-col items-start">
                                        <p className="text-sm text-milk-600">{token.symbol.toUpperCase()}</p>
                                        <p className="text-xs text-milk-400">{shortenAddress(token.address)}</p>
                                    </div>
                                </div>
                                {[selectTokenModalFor === 'buy' ? buyToken?.symbol.toLowerCase() : sellToken?.symbol.toLowerCase()].includes(
                                    token.symbol.toLowerCase(),
                                ) && (
                                    <div className="flex flex-col items-end">
                                        <p className="text-sm text-milk-600">0.000000</p>
                                        <p className="text-xs text-milk-400">$0.00</p>
                                    </div>
                                )}
                            </button>
                        ))}
                </div>
            </motion.div>
        </Backdrop>
    )
}
