declare module 'encoding-japanese' {
    export function convert(
        data: number[] | Uint8Array,
        options: {
            to: string;
            from: string;
        }
    ): number[];

    export function codeToString(code: number[]): string;
}
