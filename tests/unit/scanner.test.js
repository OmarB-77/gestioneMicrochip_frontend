import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock html5-qrcode
vi.mock('https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/+esm', () => {
    const Html5Qrcode = vi.fn()
    Html5Qrcode.prototype.start = vi.fn()
    Html5Qrcode.prototype.stop = vi.fn()
    return { Html5Qrcode }
})

import { startScan, stopScan } from '../../js/scanner.js'
import { Html5Qrcode } from 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/+esm'

describe('Scanner Module', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
        Html5Qrcode.prototype.start.mockResolvedValue(undefined)
        Html5Qrcode.prototype.stop.mockResolvedValue(undefined)
    })

    afterEach(async () => {
        vi.useRealTimers()
        // Cleanup any active scanner state
        await stopScan()
    })

    describe('startScan', () => {
        it('crea una istanza Html5Qrcode con il containerId corretto', async () => {
            const onSuccess = vi.fn()
            const onError = vi.fn()

            await startScan('scanner-container', onSuccess, onError)

            expect(Html5Qrcode).toHaveBeenCalledWith('scanner-container')
        })

        it('configura la fotocamera posteriore (environment)', async () => {
            const onSuccess = vi.fn()
            const onError = vi.fn()

            await startScan('scanner-container', onSuccess, onError)

            expect(Html5Qrcode.prototype.start).toHaveBeenCalledWith(
                { facingMode: 'environment' },
                expect.objectContaining({
                    fps: 10,
                    qrbox: { width: 250, height: 250 }
                }),
                expect.any(Function),
                expect.any(Function)
            )
        })

        it('configura i formati supportati: QR_CODE, CODE_128, EAN_13', async () => {
            const onSuccess = vi.fn()
            const onError = vi.fn()

            await startScan('scanner-container', onSuccess, onError)

            const config = Html5Qrcode.prototype.start.mock.calls[0][1]
            expect(config.formatsToSupport).toEqual([0, 5, 9])
        })

        it('chiama onSuccess quando un codice viene decodificato', async () => {
            const onSuccess = vi.fn()
            const onError = vi.fn()
            let successCallback

            Html5Qrcode.prototype.start.mockImplementation(
                (camera, config, onDecoded, onFrame) => {
                    successCallback = onDecoded
                    return Promise.resolve()
                }
            )

            await startScan('scanner-container', onSuccess, onError)
            await successCallback('123456789012345')

            expect(onSuccess).toHaveBeenCalledWith('123456789012345')
            expect(Html5Qrcode.prototype.stop).toHaveBeenCalled()
        })

        it('chiama onError con TIMEOUT dopo 30 secondi', async () => {
            const onSuccess = vi.fn()
            const onError = vi.fn()

            await startScan('scanner-container', onSuccess, onError)

            // Avanza il timer di 30 secondi
            await vi.advanceTimersByTimeAsync(30000)

            expect(onError).toHaveBeenCalledWith('TIMEOUT')
            expect(Html5Qrcode.prototype.stop).toHaveBeenCalled()
        })

        it('non chiama onError prima dei 30 secondi', async () => {
            const onSuccess = vi.fn()
            const onError = vi.fn()

            await startScan('scanner-container', onSuccess, onError)

            // Avanza il timer di 29 secondi
            await vi.advanceTimersByTimeAsync(29999)

            expect(onError).not.toHaveBeenCalled()
        })

        it('chiama onError con CAMERA_ERROR quando la fotocamera fallisce', async () => {
            const onSuccess = vi.fn()
            const onError = vi.fn()

            Html5Qrcode.prototype.start.mockRejectedValue(
                new Error('Permission denied')
            )

            await startScan('scanner-container', onSuccess, onError)

            expect(onError).toHaveBeenCalledWith('CAMERA_ERROR')
        })

        it('cancella il timeout quando un codice viene decodificato', async () => {
            const onSuccess = vi.fn()
            const onError = vi.fn()
            let successCallback

            Html5Qrcode.prototype.start.mockImplementation(
                (camera, config, onDecoded, onFrame) => {
                    successCallback = onDecoded
                    return Promise.resolve()
                }
            )

            await startScan('scanner-container', onSuccess, onError)
            await successCallback('TEST123')

            // Avanza oltre il timeout
            await vi.advanceTimersByTimeAsync(30000)

            // onError non deve essere chiamato
            expect(onError).not.toHaveBeenCalled()
        })

        it('ferma lo scanner precedente se già attivo', async () => {
            const onSuccess = vi.fn()
            const onError = vi.fn()

            await startScan('container1', onSuccess, onError)
            await startScan('container2', onSuccess, onError)

            // stop è stato chiamato per fermare il primo scanner
            expect(Html5Qrcode.prototype.stop).toHaveBeenCalled()
        })
    })

    describe('stopScan', () => {
        it('non lancia errori quando nessuno scanner è attivo', async () => {
            await expect(stopScan()).resolves.not.toThrow()
        })

        it('ferma lo scanner attivo', async () => {
            const onSuccess = vi.fn()
            const onError = vi.fn()

            await startScan('scanner-container', onSuccess, onError)
            await stopScan()

            expect(Html5Qrcode.prototype.stop).toHaveBeenCalled()
        })

        it('cancella il timeout quando lo scanner viene fermato', async () => {
            const onSuccess = vi.fn()
            const onError = vi.fn()

            await startScan('scanner-container', onSuccess, onError)
            await stopScan()

            // Avanza oltre il timeout
            await vi.advanceTimersByTimeAsync(30000)

            // onError non deve essere chiamato
            expect(onError).not.toHaveBeenCalled()
        })
    })
})
