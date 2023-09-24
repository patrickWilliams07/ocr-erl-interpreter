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

// Errors
class Error {
    constructor(text, position){
        this.text = text
        this.position = position
    }

    display(){
        let spaces = []
        for (let i=0; i<this.position; i++){
            spaces.push(' ')
        }
        return this.text + "\n" + spaces.join('') + '^'
    }
}

class UnexpectedCharacterError extends Error {
    constructor(text, position, character) {
        super(text, position)
        this.character = character
    }

    message(){
        return "Unexpected character: '" + this.character + "'\n" + this.display()
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
                number = this.make_number()
                if (number.error != null){
                    return {
                        tokens: null,
                        error: number.error
                    }
                }
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
                return null, new UnexpectedCharacterError(input, this.position, this.character)
            }
            this.continue()
        }
        return {
            tokens: tokens,
            error: null
        }
    }

    make_number(){
        let number = []
        let fullStops = 0
        while ((DIGITS.includes(this.character) || this.character == '.') && fullStops <= 1){
            number.push(this.character)
            if (this.character == '.'){
                fullStops += 1
            }
            this.continue()
        }
        switch (fullStops){
            case 0:
                return new Integer(Number(number.join('')))
                return {
                    tokens: tokens,
                    error: null
                }
            case 1:
                return new Float(Number(number.join('')))
            default:
                new UnexpectedCharacterError(thisinput, this.position, this.character)
        }
    }
}

a = new Lexer("+-*/")
console.log(a.make_tokens().tokens)