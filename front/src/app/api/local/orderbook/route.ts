import { NextRequest, NextResponse } from 'next/server'
import { AmmAsOrderbook, APIResponse } from '@/interfaces'
import { isAddress } from 'viem'
import { PUBLIC_STREAM_API_URL } from '@/config/app.config'

export async function GET(req: NextRequest) {
    const res: APIResponse<AmmAsOrderbook> = { data: undefined, error: '' }
    const url = `${PUBLIC_STREAM_API_URL}/orderbook`

    // safe exec
    try {
        // validation
        const { searchParams } = new URL(req.url)
        const token0 = searchParams.get('token0')
        const token1 = searchParams.get('token1')
        if (!token0 || !isAddress(token0)) {
            res.error = `token0 must be a valid address ${url}`
            return NextResponse.json(res, { status: 500 })
        }
        if (!token1 || !isAddress(token1)) {
            res.error = `token0 must be a valid address ${url}`
            return NextResponse.json(res, { status: 500 })
        }

        // prepare request
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 seconds timeout
        const endpoint = `${url}`
        console.log(endpoint)

        // run req
        const fetchResponse = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            cache: 'no-store',
            body: JSON.stringify({
                tag: `${token0}-${token1}`,
                single: false,
                sp_input: 'todo',
                sp_amount: 0,
            }),
        })

        // timeout
        clearTimeout(timeoutId)

        // error
        if (!fetchResponse.ok) {
            res.error = `Error fetching ${url}`
            return NextResponse.json(res, { status: fetchResponse.status })
        }

        // read and cast
        const fetchResponseJson = (await fetchResponse.json()) as { orderbook: AmmAsOrderbook }
        res.data = fetchResponseJson.orderbook

        // res
        return NextResponse.json(res)
    } catch (error) {
        return NextResponse.json({ ...res, error: `Unexpected error while fetching ${url}` }, { status: 500 })
    }
}
