// Global
const prompt = require('prompt-sync')()
const DIGITS = [..."0123456789"]
let currentText = ""

// Tokens


class Token {
    constructor(position){
        this.position = position
    }
}

class BinaryOperator extends Token{
    constructor(position){
        super(position)
        this.left = null
        this.right = null
    }

    check_for_errors(left, right){
        if (left instanceof Error){
            return left
        }
        if (right instanceof Error){
            return right
        }
        return null
    }
}

class Add extends BinaryOperator{
    constructor(position){
        super(position)
    }
    
    evaluate(){
        let left = this.left.evaluate()
        let right = this.right.evaluate()
        let result = this.check_for_errors(left, right)
        return result == null ? left + right : result
    }
}

class Minus extends BinaryOperator{
    constructor(position){
        super(position)
    }
    
    evaluate(){
        let left = this.left.evaluate()
        let right = this.right.evaluate()
        let result = this.check_for_errors(left, right)
        return result == null ? left - right : result
    }
}

class Multiply extends BinaryOperator{
    constructor(position){
        super(position)
    }
    
    evaluate(){
        let left = this.left.evaluate()
        let right = this.right.evaluate()
        let result = this.check_for_errors(left, right)
        return result == null ? left * right : result
    }
}

class Divide extends BinaryOperator{
    constructor(position){
        super(position)
    }
    
    evaluate(){
        let left = this.left.evaluate()
        let right = this.right.evaluate()
        let result = this.check_for_errors(left, right)
        if (result != null){
            return result
        }
        if (right == 0){
            return new MathError(this, "Cannot divide by 0")
        }
        return left / right
    }
}

class Exponent extends BinaryOperator{
    constructor(position){
        super(position)
    }
    
    evaluate(){
        let left = this.left.evaluate()
        let right = this.right.evaluate()
        let result = this.check_for_errors(left, right)
        if (result != null){
            return result
        }
        if (isNaN(left ** right)){
            return new MathError(this, "Cannot raise a negative number to this power")
        }
        return left ** right
    }
}

class LeftBracket extends Token{
    constructor(position){
        super(position)
    }
}

class RightBracket extends Token{
    constructor(position){
        super(position)
    }
}

class Integer extends Token{
    constructor(position, value){
        super(position)
        this.value = value
    }
    
    evaluate(){
        return this.value
    }
}

class Float extends Token{
    constructor(position, value){
        super(position)
        this.value = value
    }
    
    evaluate(){
        return this.value
    }
}

// Errors
class Error {
    constructor(position){
        this.text = currentText
        this.position = position
    }

    display(){
        return `${this.text}\n${' '.repeat(this.position)}^`
    }
}

class UnexpectedCharacterError extends Error {
    constructor(position, character) {
        super(position)
        this.character = character
    }

    message(){
        return ` ! ERROR\nUnexpected Character: '${this.character}'\n${this.display()}`
    }
}

class SyntaxError extends Error {
    constructor(token, description='') {
        super(token.position)
        this.token = token
        this.description = description
    }

    message(){
        return ` ! ERROR\nInvalid Syntax: ${this.description}\n${this.display()}`
    }
}

class MathError extends Error {
    constructor(token, description='') {
        super(token.position)
        this.token = token
        this.description = description
    }

    message(){
        return ` ! ERROR\nMath Error: ${this.description}\n${this.display()}`
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
                tokens.push(new Add(this.position))
            } else if (this.character == '-') {
                tokens.push(new Minus(this.position))
            } else if (this.character == '*') {
                tokens.push(new Multiply(this.position))
            } else if (this.character == '/') {
                tokens.push(new Divide(this.position))
            } else if (this.character == '^') {
                tokens.push(new Exponent(this.position))
            } else if (this.character == '(') {
                tokens.push(new LeftBracket(this.position))
            } else if (this.character == ')') {
                tokens.push(new RightBracket(this.position))
            } else {
                return new UnexpectedCharacterError(this.position, this.character)
            }
            this.continue()
        }
        return tokens
    }

    make_number(){
        let number = []
        let fullStops = 0
        let position = this.position
        while (DIGITS.includes(this.character) || this.character == '.'){
            number.push(this.character)
            if (this.character == '.'){
                fullStops += 1
                if (fullStops == 2){
                    return new UnexpectedCharacterError(this.position, '.')
                }
            }
            this.continue()
        }
        return fullStops == 0 ? new Integer(position, Number(number.join(''))) : new Float(position, Number(number.join('')))
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
        let result = this.expression(this)
        if (result instanceof Error){
            return result
        }
        if (this.token == null){
            return result
        }
        return new SyntaxError(this.token, "Expected operator")
    }

    factor(self){
        if (self.check_instance([Integer, Float])){
            let result = self.token
            self.continue()
            return result
        } else if (self.check_instance([LeftBracket])){
            let errorToken = self.token
            self.continue()
            let result = self.expression(self)
            if (self.check_instance([RightBracket])){
                self.continue()
                return result
            }
            return new SyntaxError(errorToken,  "'(' was never closed")
        } else if (self.check_instance([Add])){
            let errorToken = self.token
            self.continue()
            if (self.token == null){
                return new SyntaxError(errorToken.position, "Incomplete input")
            }
            return self.factor(self)
        } else if (self.check_instance([Minus])){
            let errorToken = self.token
            self.continue()
            if (self.token == null){
                return new SyntaxError(errorToken, "Incomplete input")
            }
            let right = self.factor(self)
            if (right instanceof Error){
                return right
            }
            let result = new Minus(self.position)
            result.left = new Integer(self.position, 0)
            result.right = right
            return result
        }
        console.log('E')
        return new SyntaxError(self.token, "Expected literal")
    }

    exponent(self){
        return self.parse_binary_operator(self, self.factor, [Exponent])
    }

    term(self){
        return self.parse_binary_operator(self, self.exponent, [Multiply, Divide])
    }

    expression(self){
        return self.parse_binary_operator(self, self.term, [Add, Minus])
    }

    // First parameter = References the instance of the parser
    // Second parameter = Method to call that is beneath the current one
    // Thid parameter = Array of tokens which are to be checked for
    parse_binary_operator(self, nextFunction, tokens){
        let result = nextFunction(self)
        if (result instanceof Error){
            return result
        }
        while (self.token != null && self.check_instance(tokens)){
            self.token.left = result
            result = self.token
            self.continue()
            if (self.token == null){
                return new SyntaxError(result, "Incomplete Input")
            }
            result.right = nextFunction(self)
            if (result.right instanceof Error){
                return result.right
            }
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
        currentText = input
        let tokens = new Lexer(input).make_tokens()
        if (tokens instanceof Error){
            console.log(tokens.message())
            return
        }
        let parsed = new Parser(tokens).parse()
        if (parsed instanceof Error){
            console.log(parsed.message())
            return
        }
        let evaluated = parsed.evaluate()
        console.log(evaluated instanceof Error ? evaluated.message() : evaluated)
    }
}

new Shell()
