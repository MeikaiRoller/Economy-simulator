const levels = [10, 20, 30, 40, 50, 60];
console.log('=== HP SCALING (15x per level) ===\n');
console.log('Level | Base HP | +50% HP Chest | Total HP');
console.log('------|---------|---------------|----------');
levels.forEach(level => {
  const baseHP = 250 + (level * 15);
  const withChest = Math.floor(baseHP * 1.5);
  console.log(`  ${level.toString().padStart(2)}  | ${baseHP.toString().padStart(7)} | ${withChest.toString().padStart(13)} | ${withChest.toString().padStart(8)}`);
});

console.log('\n\n=== DAMAGE REDUCTION SCALING ===\n');
console.log('Defense | Damage Reduction');
console.log('--------|------------------');
[50, 100, 150, 200, 300, 400, 500].forEach(def => {
  const reduction = ((def / (def + 100)) * 100).toFixed(1);
  console.log(`  ${def.toString().padStart(3)}   | ${reduction.padStart(5)}%`);
});

console.log('\n\n=== COMBAT EXAMPLE (Level 40) ===');
console.log('Player 1: 1000 Attack vs Player 2: 200 Defense, 850 HP');
const attack = 1000;
const defense = 200;
const hp = 850;
const damageReduction = defense / (defense + 100);
const avgDamage = Math.floor(attack * (1 - damageReduction) * 1.0);
const turnsToKill = Math.ceil(hp / avgDamage);
console.log(`Damage per hit: ${avgDamage}`);
console.log(`Turns to kill: ${turnsToKill}`);
