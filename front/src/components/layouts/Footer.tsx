import { cn } from '@/utils'

export default function Footer(props: { className?: string }) {
    return (
        <div className={cn('w-full flex justify-between py-6 px-8 text-milk-600/50 font-light text-sm', props.className)}>
            <div className="flex gap-10">
                <p>2024 © PropellerHeads</p>
                <p>Alpha Version Notice</p>
            </div>
            <p>Made by PropellerHeads</p>
        </div>
    )
}
