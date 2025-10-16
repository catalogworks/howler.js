import { describe, expect, test } from 'bun:test';
import { Howl, Howler } from '../src/index';
describe('Howler Core Tests', () => {
    test('Howler global object should exist', () => {
        expect(Howler).toBeDefined();
        expect(Howler.volume).toBeInstanceOf(Function);
        expect(Howler.mute).toBeInstanceOf(Function);
    });
    test('Howl creation works', () => {
        const sound = new Howl({
            src: ['test.mp3']
        });
        expect(sound).toBeDefined();
        expect(sound.play).toBeInstanceOf(Function);
        expect(sound.pause).toBeInstanceOf(Function);
        expect(sound.stop).toBeInstanceOf(Function);
    });
    test('Howl has on/off methods', () => {
        const sound = new Howl({
            src: ['test.mp3']
        });
        expect(sound.on).toBeInstanceOf(Function);
        expect(sound.off).toBeInstanceOf(Function);
    });
    test('Volume controls work', () => {
        const sound = new Howl({
            src: ['test.mp3'],
            volume: 0.5
        });
        expect(sound.volume()).toBe(0.5);
        sound.volume(0.8);
        expect(sound.volume()).toBe(0.8);
    });
});
describe('Spatial Plugin Tests', () => {
    test('Spatial methods exist on Howler', () => {
        expect(Howler.pos).toBeInstanceOf(Function);
        expect(Howler.orientation).toBeInstanceOf(Function);
        expect(Howler.stereo).toBeInstanceOf(Function);
    });
    test('Spatial methods exist on Howl', () => {
        const sound = new Howl({
            src: ['test.mp3']
        });
        expect(sound.pos).toBeInstanceOf(Function);
        expect(sound.orientation).toBeInstanceOf(Function);
        expect(sound.stereo).toBeInstanceOf(Function);
        expect(sound.pannerAttr).toBeInstanceOf(Function);
    });
    test('Stereo panning works', () => {
        const sound = new Howl({
            src: ['test.mp3']
        });
        sound.stereo(0.5);
        // Can't test actual audio output, but we can ensure the method doesn't throw
        expect(true).toBe(true);
    });
});
//# sourceMappingURL=basic.test.js.map