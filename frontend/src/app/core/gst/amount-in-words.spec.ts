import { amountInWords } from './amount-in-words';

describe('amountInWords', () => {
  it.each([
    [0, 'Indian Rupees Zero Only'],
    [15, 'Indian Rupees Fifteen Only'],
    [105, 'Indian Rupees One Hundred Five Only'],
    [60180, 'Indian Rupees Sixty Thousand One Hundred Eighty Only'],
    [1049.99, 'Indian Rupees One Thousand Forty Nine and Ninety Nine Paise Only'],
    [1250000, 'Indian Rupees Twelve Lakh Fifty Thousand Only'],
    [10000000, 'Indian Rupees One Crore Only'],
    [1505000000.5, 'Indian Rupees One Hundred Fifty Crore Fifty Lakh and Fifty Paise Only'],
  ])('%s → %s', (amount, words) => {
    expect(amountInWords(amount)).toBe(words);
  });
});
