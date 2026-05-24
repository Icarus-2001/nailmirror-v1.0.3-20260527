// C1 单测：utils/event-bus.js — 全局事件总线
// 注意：handlers 是模块单例 state，每个测试需要 jest.resetModules() 隔离

describe('utils/event-bus', () => {
  let bus;
  beforeEach(() => {
    jest.resetModules();
    bus = require('../../utils/event-bus');
  });

  test('on + emit 基本流：订阅者收到事件参数', () => {
    const fn = jest.fn();
    bus.on('payment-success', fn);
    bus.emit('payment-success', { orderId: 'O001' }, 99);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith({ orderId: 'O001' }, 99);
  });

  test('off 解绑：解绑后 emit 不再触发', () => {
    const fn = jest.fn();
    bus.on('e1', fn);
    bus.off('e1', fn);
    bus.emit('e1', 'x');
    expect(fn).not.toHaveBeenCalled();
  });

  test('多订阅者并发触发：全部按序收到事件', () => {
    const a = jest.fn(); const b = jest.fn(); const c = jest.fn();
    bus.on('refresh', a);
    bus.on('refresh', b);
    bus.on('refresh', c);
    bus.emit('refresh', 1);
    expect(a).toHaveBeenCalledWith(1);
    expect(b).toHaveBeenCalledWith(1);
    expect(c).toHaveBeenCalledWith(1);
  });

  test('emit 不存在的事件不抛错', () => {
    expect(() => bus.emit('never-subscribed', 'data')).not.toThrow();
  });

  test('on 返回 unsubscribe 函数：调用后解绑该订阅', () => {
    const fn = jest.fn();
    const unsub = bus.on('e2', fn);
    unsub();
    bus.emit('e2');
    expect(fn).not.toHaveBeenCalled();
  });

  test('once：仅触发一次，第二次 emit 不再调用', () => {
    const fn = jest.fn();
    bus.once('boot', fn);
    bus.emit('boot', 'first');
    bus.emit('boot', 'second');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('first');
  });

  test('handler 抛错被吞，不影响后续订阅者', () => {
    const bad = jest.fn(() => { throw new Error('handler boom'); });
    const good = jest.fn();
    bus.on('mix', bad);
    bus.on('mix', good);
    expect(() => bus.emit('mix', 1)).not.toThrow();
    expect(bad).toHaveBeenCalled();
    expect(good).toHaveBeenCalledWith(1);
  });
});
