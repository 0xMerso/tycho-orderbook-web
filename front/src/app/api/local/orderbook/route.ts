import { NextRequest, NextResponse } from 'next/server'
import { AmmAsOrderbook, StructuredOutput } from '@/interfaces'
import { isAddress } from 'viem'
import { PUBLIC_STREAM_API_URL } from '@/config/app.config'
import { initOutput } from '@/utils'

export async function GET(req: NextRequest) {
    const res = initOutput<AmmAsOrderbook>()
    const url = `${PUBLIC_STREAM_API_URL}/orderbook` // todo select vm http endpoint in production

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
        const body = {
            tag: `${token0}-${token1}`,
            single: false,
            sp_input: 'todo',
            sp_amount: 0,
        }

        // debug
        // console.log('-------')
        // console.log({ url, body })

        // run req
        const fetchResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', [`${process.env.API_HEADER_KEY}`]: `${process.env.API_HEADER_VALUE}` },
            signal: controller.signal,
            cache: 'no-store',
            body: JSON.stringify(body),
        })

        // timeout
        clearTimeout(timeoutId)

        // error
        if (!fetchResponse.ok) {
            res.error = `Error fetching ${url}`
            return NextResponse.json(res, { status: fetchResponse.status })
        }

        // read and cast
        const fetchResponseJson = (await fetchResponse.json()) as StructuredOutput<AmmAsOrderbook>
        res.ts = fetchResponseJson.ts
        res.error = fetchResponseJson.error
        res.data = fetchResponseJson.data

        // double check errors
        if (String(res.data).includes('backend error')) {
            return NextResponse.json({ ...res, error: `Upstream rust API returned an error` }, { status: 502 })
        }

        // res
        return NextResponse.json(res)
    } catch (error) {
        return NextResponse.json({ ...res, error: `Unexpected error while fetching ${url}` }, { status: 500 })
    }
}
