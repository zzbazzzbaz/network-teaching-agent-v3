import { describe, expect, it } from 'vitest';

import { defaultPassword, isDefaultPassword } from './password';

describe('默认密码规则', () => {
  it('在用户名后追加 000000', () => {
    expect(defaultPassword('student01')).toBe('student01000000');
    expect(defaultPassword('zhangsan')).toBe('zhangsan000000');
  });

  it('仅识别精确的默认密码', () => {
    expect(isDefaultPassword('student01', 'student01000000')).toBe(true);
    expect(isDefaultPassword('student01', 'student01000001')).toBe(false);
    expect(isDefaultPassword('student01', 'Student01000000')).toBe(false);
  });
});
