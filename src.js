class SymbolTable {
    constructor(){
        this.table = []
    }

    find(token){
        for (let item of this.table){
            if (item.name == token.name){
                item.lastReferenced = token
                return item
            }
        }
        this.table.push(new DataType(token))
        return this.table[this.table.length - 1]
    }
}

class DataType {
    constructor(token){
        this.name = token.name
        this._value = null
        this.lastReferenced = token
        this.constant = token.constant
        if (this.constant){
            this.declared = false
        }
    }

    get value(){
        if (this._value == null){
            return new IdentifierError(this.lastReferenced, "was not declared")
        }
        return this._value
    }

    set(newValue){
        if (this.lastReferenced.constant == true){
            this.constant = true
            this.declared = false
        }
        if (!(this.constant)){
            this._value = newValue
            return null
        }
        if (this.declared){
            return new IdentifierError(this.lastReferenced, "is a constant and has already been defined")
        }
        this.declared = true
        this._value = newValue
        return null
    }
}

// Global usage
const prompt = require('prompt-sync')()
const DIGITS = [..."0123456789"]
const LETTERS = [..."qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM"]
let global = new SymbolTable()
let currentText = ""

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

    // Ensure that if an error has been returned it is not involved in a calculation
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
        if (isNaN(left ** right)){ // No imaginary numbers
            return new MathError(this, "Cannot raise a negative number to this power")
        }
        return left ** right
    }
}

class Equals extends BinaryOperator{
    constructor(position){
        super(position)
    }

    evaluate(){
        let left = this.left.assign()
        let right = this.right.evaluate()
        let result = this.check_for_errors(left, right)
        if (result != null){
            return result
        }
        return left.set(right)
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

class Identifier extends Token{
    constructor(position, name, constant=false){
        super(position)
        this.name = name
        this.constant = constant
    }

    evaluate(){
        return global.find(this).value
    }

    assign(){
        return global.find(this)
    }
}

class Keyword extends Token{
    constructor(position){
        super(position)
    }
}

// For generic keywords like const, global which don't need a unique object object
class TemplateKeyword extends Keyword{
    constructor(position, tag){
        super(position)
        this.tag = tag
    }
}


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

class IdentifierError extends Error{
    constructor(token, description='') {
        super(token.position)
        this.token = token
        this.description = description
    }

    message(){
        return ` ! ERROR\nIdentifier Error: '${this.token.name}' ${this.description}\n${this.display()}`
    }
}

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
            } else if (LETTERS.includes(this.character)){
                tokens.push(this.make_identifier())
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
            } else if (this.character == '=') {
                tokens.push(new Equals(this.position))
            } else if (this.character == '(') {
                tokens.push(new LeftBracket(this.position))
            } else if (this.character == ')') {
                tokens.push(new RightBracket(this.position))
            } else { // Not recognised
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

    make_identifier(){
        let name = []
        let position = this.position
        while (LETTERS.includes(this.character) || DIGITS.includes(this.character)){
            name.push(this.character)
            this.continue()
        }
        name = name.join('')
        switch (name) {
            case "const":
                return new TemplateKeyword(position, "const")
            default:
                return new Identifier(position, name)
        }
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

    reset(){
        this.position = -1
        this.continue()
    }

    // Takes in an array and checks if current token is instance of the items
    check_instance(check) {
        for (let item of check){
            if (this.token instanceof item){
                return true
            }
        }
        return false
    }

    parse(){
        // Check if there are no tokens
        if (this.token == null){
            return null
        }
        // Check if there is a tagged assignment
        if (this.token instanceof TemplateKeyword){
            let result = this.assignment(this, this.token.tag)
            return this.check_result(result) ? result : new SyntaxError(this.token, "Expected operator")
        }
        // Check if it is a normal assignment
        if (this.token instanceof Identifier){
            this.continue()
            let token = this.token
            this.reset()
            if (token instanceof Equals){
                let result = this.assignment(this)
                return this.check_result(result) ? result : new SyntaxError(this.token, "Expected operator")
            }
        }
        // Left over case is just an expression
        let result = this.expression(this)
        return this.check_result(result) ? result : new SyntaxError(this.token, "Expected operator")
    }

    check_result(result){
        if (result instanceof Error || this.token == null){
            return true
        }
        return false
    }

    factor(self){
        if (self.check_instance([Integer, Float, Identifier])){
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
        } else if (self.check_instance([Add])){ // Add unary operator
            let errorToken = self.token
            self.continue()
            if (self.token == null){
                return new SyntaxError(errorToken.position, "Incomplete input")
            }
            return self.factor(self)
        } else if (self.check_instance([Minus])){ // Minus unary operator
            let errorToken = self.token
            self.continue()
            if (self.token == null){
                return new SyntaxError(errorToken, "Incomplete input")
            }
            let right = self.factor(self)
            if (right instanceof Error){
                return right
            }
            let result = new Minus(self.position) // Just adds minus node of 0 - value
            result.left = new Integer(self.position, 0)
            result.right = right
            return result
        } // Two operators in a row
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

    assignment(self, tag=null){
        let errorToken
        if (tag != null){
            errorToken = this.token
            self.continue()
        }
        let left = self.token
        if (left == null){
            return new SyntaxError(errorToken, `epected identifier after '${errorToken.tag}'`)
        }
        if (tag == "const"){
            left = new Identifier(left.position, left.name, true)
        }
        self.continue()
        let result = self.token
        if (!(result instanceof Equals)){
            return new SyntaxError(result, "expected '='")
        }
        errorToken = self.token
        self.continue()
        if (self.token == null){
            return new SyntaxError(errorToken, "Incomplete input")
        }
        let right = self.expression(self)
        if (right instanceof Error){
            return right
        }
        result.left = left
        result.right = right
        return result
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

    main(){ // Can only be run in terminal as inputs don't work in VScode
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
        if (parsed == null){
            return
        }
        let evaluated = parsed.evaluate()
        if (evaluated instanceof Error){
            console.log(evaluated.message())
            return
        }
        if (evaluated != null){
            console.log(evaluated)
        }
        return
    }
}

new Shell()