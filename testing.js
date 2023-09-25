// Constants

const DIGITS = [..."0123456789"]

// Tokens

class Token {
    constructor(){
    }
}

class Add extends Token{
    constructor(){
        super()
    }
}

class Minus extends Token{
    constructor(){
        super()
    }
}

class Multiply extends Token{
    constructor(){
        super()
    }
}

class Divide extends Token{
    constructor(){
        super()
    }
}

class LeftBracket extends Token{
    constructor(){
        super()
    }
}

class RightBracket extends Token{
    constructor(){
        super()
    }
}

class Integer extends Token{
    constructor(value){
        super()
        this.value = value
    }
}

class Float extends Token{
    constructor(value){
        super()
        this.value = value
    }
}

// Lexer

class Lexer {
    constructor(input){
        this.input = input
        this.position = -1
        this.character = null
        this.continue()
    }

    continue(){
        this.position += 1
        if (this.position == this.input.length){
            this.character = null
        } else {
            this.character = this.input[this.position]
        }
    }

    make_tokens(){
        let tokens = []
        while (this.character != null){
            if (this.character == ' '){
            } else if (DIGITS.includes(this.character)) {
                tokens.push(this.make_number())
                continue
            } else if (this.character == '+') {
                tokens.push(new Add())
            } else if (this.character == '-') {
                tokens.push(new Minus())
            } else if (this.character == '*') {
                tokens.push(new Multiply())
            } else if (this.character == '/') {
                tokens.push(new Divide())
            } else if (this.character == '(') {
                tokens.push(new LeftBracket())
            } else if (this.character == ')') {
                tokens.push(new RightBracket())
            } else {
                console.log("ERROR: Unexpected Character: '", this.character, "'")
            }
            this.continue()
        }
        return tokens
    }

    make_number(){
        let number = []
        let fullStops = 0
        while ((DIGITS.includes(this.character) || this.character == '.') && fullStops <=1){
            number.push(this.character)
            if (this.character == '.'){
                fullStops += 1
            }
            this.continue()
        }
        switch (fullStops){
            case 0:
                return new Integer(Number(number.join('')))
            case 1:
                return new Float(Number(number.join('')))
            default:
                console.log("ERROR: Too many decimal places")
        }
    }
}

// Testing
test = new Lexer("2+3-4")
console.log(test.make_tokens())
test2 = new Lexer("5.75 * 6.234 + 4 / 79 * (3.14 + 2.17)")
console.log(test2.make_tokens())