import { AudioOptions, defaultAudioOptions } from './AudioOptions'
import Mixer from '.';
import { Writable } from 'stream';

export interface InputOptions extends AudioOptions {
    volume: number
}

type hrtime = [number, number]

const NS_PER_SEC = 1e9

export default class Input extends Writable {

    protected lastRead: hrtime = [0, 0]
    protected buffer: Buffer = Buffer.allocUnsafe(0)

    constructor (protected mixer: Mixer, public options: InputOptions) {
        super()

        this.options = { ...defaultAudioOptions, volume: 1, ...options }
    }

    silence (size: number) : Buffer {
        let silentBuffer = Buffer.allocUnsafe(size * this.options.channels)
        let silence = this.options.signed ? 0 : (Math.pow(2, this.options.bitDepth) / 2)

        silentBuffer.fill(silence)
        return silentBuffer
    }

    readSamples (size: number, time: hrtime) : Buffer {
        this.lastRead = time

        if (this.buffer.length < size) {
            return this.silence(size)
        }

        let buffer = this.buffer.slice(0, size)
        this.buffer = this.buffer.slice(size)

        return buffer
    }

    _write (chunk: Buffer, encoding: any, next: any) {
        let timeDifference = process.hrtime(this.lastRead)
        let timeDifferenceInNs = timeDifference[0] * NS_PER_SEC + timeDifference[1]

        const { channels, samplingRate, bitDepth } = this.options

        let samplesInChunk = chunk.length / channels
        let samplesRequired = Math.floor(timeDifferenceInNs / NS_PER_SEC * samplingRate)

        if (samplesInChunk < samplesRequired) {
            this.buffer = Buffer.concat([this.buffer, this.silence(samplesRequired - samplesInChunk)])
        }

        this.buffer = Buffer.concat([this.buffer, chunk])

        next()
    }

}