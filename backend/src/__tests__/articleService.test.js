/**
 * ArticleService 核心純函數單元測試
 * 測試目標：parseCountTokenToNumber、extractCountPromiseFromHeading、countLabeledSubheadings
 */

const ArticleService = require('../services/articleService');

// ==================== parseCountTokenToNumber ====================

describe('parseCountTokenToNumber', () => {
  // 基本阿拉伯數字
  test('should parse Arabic digits', () => {
    expect(ArticleService.parseCountTokenToNumber('3')).toBe(3);
    expect(ArticleService.parseCountTokenToNumber('10')).toBe(10);
    expect(ArticleService.parseCountTokenToNumber('21')).toBe(21);
    expect(ArticleService.parseCountTokenToNumber('99')).toBe(99);
    expect(ArticleService.parseCountTokenToNumber('0')).toBe(0);
  });

  // 基本中文數字（個位）
  test('should parse single Chinese numerals', () => {
    expect(ArticleService.parseCountTokenToNumber('零')).toBe(0);
    expect(ArticleService.parseCountTokenToNumber('一')).toBe(1);
    expect(ArticleService.parseCountTokenToNumber('二')).toBe(2);
    expect(ArticleService.parseCountTokenToNumber('兩')).toBe(2);
    expect(ArticleService.parseCountTokenToNumber('三')).toBe(3);
    expect(ArticleService.parseCountTokenToNumber('四')).toBe(4);
    expect(ArticleService.parseCountTokenToNumber('五')).toBe(5);
    expect(ArticleService.parseCountTokenToNumber('六')).toBe(6);
    expect(ArticleService.parseCountTokenToNumber('七')).toBe(7);
    expect(ArticleService.parseCountTokenToNumber('八')).toBe(8);
    expect(ArticleService.parseCountTokenToNumber('九')).toBe(9);
  });

  // 十位中文數字
  test('should parse "十" as 10', () => {
    expect(ArticleService.parseCountTokenToNumber('十')).toBe(10);
  });

  test('should parse 十X format (11-19)', () => {
    expect(ArticleService.parseCountTokenToNumber('十一')).toBe(11);
    expect(ArticleService.parseCountTokenToNumber('十二')).toBe(12);
    expect(ArticleService.parseCountTokenToNumber('十五')).toBe(15);
    expect(ArticleService.parseCountTokenToNumber('十九')).toBe(19);
  });

  test('should parse X十 format (20, 30...)', () => {
    expect(ArticleService.parseCountTokenToNumber('二十')).toBe(20);
    expect(ArticleService.parseCountTokenToNumber('三十')).toBe(30);
    expect(ArticleService.parseCountTokenToNumber('五十')).toBe(50);
    expect(ArticleService.parseCountTokenToNumber('九十')).toBe(90);
  });

  test('should parse X十Y format (21, 35...)', () => {
    expect(ArticleService.parseCountTokenToNumber('二十一')).toBe(21);
    expect(ArticleService.parseCountTokenToNumber('三十五')).toBe(35);
    expect(ArticleService.parseCountTokenToNumber('九十九')).toBe(99);
  });

  // 邊界值與無效輸入
  test('should return null for empty/null/undefined', () => {
    expect(ArticleService.parseCountTokenToNumber(null)).toBeNull();
    expect(ArticleService.parseCountTokenToNumber(undefined)).toBeNull();
    expect(ArticleService.parseCountTokenToNumber('')).toBeNull();
    expect(ArticleService.parseCountTokenToNumber('  ')).toBeNull();
  });

  test('should return null for invalid strings', () => {
    expect(ArticleService.parseCountTokenToNumber('abc')).toBeNull();
    expect(ArticleService.parseCountTokenToNumber('你好')).toBeNull();
  });

  // 帶空白的輸入
  test('should trim whitespace', () => {
    expect(ArticleService.parseCountTokenToNumber(' 5 ')).toBe(5);
    expect(ArticleService.parseCountTokenToNumber(' 三 ')).toBe(3);
  });
});

// ==================== extractCountPromiseFromHeading ====================

describe('extractCountPromiseFromHeading', () => {
  // 有效的 count promise
  test('should extract Arabic digit promises', () => {
    const result = ArticleService.extractCountPromiseFromHeading('3大陷阱');
    expect(result).toEqual({ kind: 'trap', label: '陷阱', count: 3 });
  });

  test('should extract Chinese numeral promises', () => {
    const result = ArticleService.extractCountPromiseFromHeading('五個方法');
    expect(result).toEqual({ kind: 'generic', label: '方法', count: 5 });
  });

  test('should extract step promises', () => {
    expect(ArticleService.extractCountPromiseFromHeading('3步驟')).toEqual({
      kind: 'step', label: '步驟', count: 3
    });
    expect(ArticleService.extractCountPromiseFromHeading('五個步驟')).toEqual({
      kind: 'step', label: '步驟', count: 5
    });
  });

  test('should extract various kinds', () => {
    expect(ArticleService.extractCountPromiseFromHeading('3大迷思').kind).toBe('myth');
    expect(ArticleService.extractCountPromiseFromHeading('5個錯誤').kind).toBe('mistake');
    expect(ArticleService.extractCountPromiseFromHeading('3個誤區').kind).toBe('mistake');
    expect(ArticleService.extractCountPromiseFromHeading('4個疑問').kind).toBe('question');
    expect(ArticleService.extractCountPromiseFromHeading('5個問題').kind).toBe('question');
    expect(ArticleService.extractCountPromiseFromHeading('3個重點').kind).toBe('generic');
    expect(ArticleService.extractCountPromiseFromHeading('5個技巧').kind).toBe('generic');
  });

  // 序位步驟應回傳 null（「第一步」是序位，不是承諾）
  test('should return null for ordinal step headings', () => {
    expect(ArticleService.extractCountPromiseFromHeading('第一步')).toBeNull();
    expect(ArticleService.extractCountPromiseFromHeading('第3步')).toBeNull();
    expect(ArticleService.extractCountPromiseFromHeading('第三步：設定環境')).toBeNull();
  });

  // count < 2 應回傳 null（承諾「1個」沒有意義）
  test('should return null for count less than 2', () => {
    expect(ArticleService.extractCountPromiseFromHeading('1個方法')).toBeNull();
    expect(ArticleService.extractCountPromiseFromHeading('一個重點')).toBeNull();
  });

  // 無效輸入
  test('should return null for non-promise headings', () => {
    expect(ArticleService.extractCountPromiseFromHeading('如何選擇最佳方案')).toBeNull();
    expect(ArticleService.extractCountPromiseFromHeading('結論與建議')).toBeNull();
    expect(ArticleService.extractCountPromiseFromHeading('')).toBeNull();
    expect(ArticleService.extractCountPromiseFromHeading(null)).toBeNull();
    expect(ArticleService.extractCountPromiseFromHeading(undefined)).toBeNull();
  });
});

// ==================== countLabeledSubheadings ====================

describe('countLabeledSubheadings', () => {
  test('should count unique labeled subheadings with Arabic digits', () => {
    const html = `
      <h3>陷阱1：低價騙局</h3><p>...</p>
      <h3>陷阱2：假冒品牌</h3><p>...</p>
      <h3>陷阱3：隱藏費用</h3><p>...</p>
    `;
    expect(ArticleService.countLabeledSubheadings(html, '陷阱')).toBe(3);
  });

  test('should count unique labeled subheadings with Chinese numerals', () => {
    const html = `
      <h3>陷阱一：低價騙局</h3><p>...</p>
      <h3>陷阱二：假冒品牌</h3><p>...</p>
    `;
    expect(ArticleService.countLabeledSubheadings(html, '陷阱')).toBe(2);
  });

  test('should deduplicate repeated headings', () => {
    const html = `
      <h3>陷阱1：低價騙局</h3><p>...</p>
      <h3>陷阱1：低價騙局</h3><p>...</p>
      <h3>陷阱2：假冒品牌</h3><p>...</p>
    `;
    expect(ArticleService.countLabeledSubheadings(html, '陷阱')).toBe(2);
  });

  test('should return 0 when no matching subheadings', () => {
    const html = '<h3>如何選擇</h3><p>...</p>';
    expect(ArticleService.countLabeledSubheadings(html, '陷阱')).toBe(0);
  });

  test('should return 0 for empty inputs', () => {
    expect(ArticleService.countLabeledSubheadings('', '陷阱')).toBe(0);
    expect(ArticleService.countLabeledSubheadings(null, '陷阱')).toBe(0);
    expect(ArticleService.countLabeledSubheadings('<h3>test</h3>', '')).toBe(0);
    expect(ArticleService.countLabeledSubheadings('<h3>test</h3>', null)).toBe(0);
  });

  test('should handle mixed Arabic and Chinese numerals', () => {
    const html = `
      <h3>步驟1：安裝</h3><p>...</p>
      <h3>步驟二：設定</h3><p>...</p>
      <h3>步驟3：測試</h3><p>...</p>
    `;
    expect(ArticleService.countLabeledSubheadings(html, '步驟')).toBe(3);
  });

  test('should not count subheadings with different labels', () => {
    const html = `
      <h3>陷阱1：問題A</h3><p>...</p>
      <h3>技巧1：方法A</h3><p>...</p>
      <h3>陷阱2：問題B</h3><p>...</p>
    `;
    expect(ArticleService.countLabeledSubheadings(html, '陷阱')).toBe(2);
    expect(ArticleService.countLabeledSubheadings(html, '技巧')).toBe(1);
  });
});
