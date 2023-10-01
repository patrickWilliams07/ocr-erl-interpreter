// Constants
const prompt = require('prompt-sync')()
const DIGITS = [..."0123456789"]

// Tokens

class Token {
    constructor(){
    }
}

class BinaryOperator extends Token{
    constructor(){
        super()
        this.left = null
        this.right = null
    }
}

class Add extends BinaryOperator{
    constructor(){
        super()
    }
}

class Minus extends BinaryOperator{
    constructor(){
        super()
    }
}

class Multiply extends BinaryOperator{
    constructor(){
        super()
    }
}

class Divide extends BinaryOperator{
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
        return `${this.text}\n${' '.repeat(this.position)}^`
    }
}

class UnexpectedCharacterError extends Error {
    constructor(text, position, character) {
        super(text, position)
        this.character = character
    }

    message(){
        return ` ! ERROR\nUnexpected Character: '${this.character}'\n${this.display()}`
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
        this.character = this.position == this.input.length ? null : this.input[this.position]
    }

    make_tokens(){
        let tokens = []
        while (this.character != null){
            if (this.character == ' '){
            } else if (DIGITS.includes(this.character)) {
                let number = this.make_number()
                if (number instanceof Error) {
                    return number
                }
                tokens.push(number)
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
                return new UnexpectedCharacterError(this.input, this.position, this.character)
            }
            this.continue()
        }
        return tokens
    }

    make_number(){
        let number = []
        let fullStops = 0
        while (DIGITS.includes(this.character) || this.character == '.'){
            number.push(this.character)
            if (this.character == '.'){
                fullStops += 1
                if (fullStops == 2){
                    return new UnexpectedCharacterError(this.input, this.position, '.')
                }
            }
            this.continue()
        }
        return fullStops == 0 ? new Integer(Number(number.join(''))) : new Float(Number(number.join('')))
    }
}

class Parser {
    constructor(tokens){
        this.tokens = tokens
        this.position = -1
        this.token = null
        this.continue()
    }

    continue(){
        this.position += 1
        this.token = this.position == this.tokens.length ? null : this.tokens[this.position]
    }


    check_instance(check) {
        for (let item of check){
            if (this.token instanceof item){
                return true
            }
        }
        return false
    }

    parse(){
        return this.expression(this)
    }

    factor(parent){
        let result = parent.token
        parent.continue()
        return result
    }

    term(parent){
        return parent.parse_binary_operator(parent, parent.factor, [Add, Minus])
    }

    expression(parent){
        return parent.parse_binary_operator(parent, parent.term, [Add, Minus])
    }

    parse_binary_operator(parent, nextFunction, tokens){
        let result = nextFunction(parent)
        while (parent.token != null && parent.check_instance(tokens)){
            parent.token.left = result
            result = parent.token
            parent.continue()
            result.right = nextFunction(parent)
        }
        return result
    }
}


class Shell {
    constructor() {
        this.main()
    }

    main(){
        let input = prompt(" ERL ==> ")
        while (input != "QUIT()"){
            this.run(input)
            input = prompt(" ERL ==> ")
        }
    }

    run(input){
        let tokens = new Lexer(input).make_tokens()
        console.log(tokens instanceof Error ? tokens.message() : tokens)
    }
}

test = new Parser(new Lexer("2 + 3 + 4").make_tokens()).parse()
console.log(test)
