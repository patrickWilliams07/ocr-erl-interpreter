function getIntegerRandom(min, max){
    return Math.floor(Math.random() * (max - min + 1) + min)
}

function getFloatRandom(min, max){
    return Math.random() * (max - min) + min
}

total = 0
trials = 10000000
for (let i = 0; i < trials; i++){
    total += getFloatRandom(1, 9)
}
console.log(total/trials)

console.log(getFloatRandom(1,9))