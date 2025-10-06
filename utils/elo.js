const K_FACTOR = 20;

function calcExpected(Ra, Rb) {
  return 1 / (1 + Math.pow(10, (Rb - Ra) / 400));
}

function eloUpdate(Ra, Rb, scoreA, K = K_FACTOR) {
  const Ea = calcExpected(Ra, Rb);
  return Math.round(Ra + K * (scoreA - Ea));
}

module.exports = { calcExpected, eloUpdate, K_FACTOR };