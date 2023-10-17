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
const fs = require('fs')
const DIGITS = [..."0123456789"]
const LETTERS = [..."qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM"]
let global = new SymbolTable()
let currentText = ""

class Token {
    constructor(position){
        this.position = position
    }

    evaluate(){
        return this
    }

    check_for_float(){
        for (let item of arguments){
            if (item instanceof Float){
                return true
            }
            if (typeof item === 'number'){
                if (String(item).includes('.')){
                    return true
                }
            }
        }
        return false
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
        if (result != null){
            return result
        }
        result = left.value + right.value
        return this.check_for_float(left, right, result) ? new Float(this.position, result) : new Integer(this.position, result)
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
        if (result != null){
            return result
        }
        result = left.value - right.value
        return this.check_for_float(left, right, result) ? new Float(this.position, result) : new Integer(this.position, result)
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
        if (result != null){
            return result
        }
        result = left.value * right.value
        return this.check_for_float(left, right, result) ? new Float(this.position, result) : new Integer(this.position, result)
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
        if (right.value == 0){
            return new MathError(this, "Cannot divide by 0")
        }
        result = left.value * right.value
        return this.check_for_float(left, right, result) ? new Float(this.position, result) : new Integer(this.position, result)
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
        result = left.value ** right.value
        if (isNaN(result)){ // No imaginary numbers
            return new MathError(this, "Cannot raise a negative number to this power")
        }
        return this.check_for_float(left, right, result) ? new Float(this.position, result) : new Integer(this.position, result)
    }
}

// =
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

class And extends BinaryOperator{
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
        return new Boolean(this.position, left.value && right.value)
    }
}

class Or extends BinaryOperator{
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
        return new Boolean(this.position, left.value || right.value)
    }
}

class LogicalOperator extends BinaryOperator{
    constructor(position, tag){
        super(position)
        this.tag = tag
    }

    evaluate(){
        let left = this.left.evaluate()
        let right = this.right.evaluate()
        let result = this.check_for_errors(left, right)
        if (result != null){
            return result
        }
        switch (this.tag){
            case "==":
                return new Boolean(this.position, left.value == right.value)
            case ">":
                return new Boolean(this.position, left.value > right.value)
            case ">=":
                return new Boolean(this.position, left.value >= right.value)
            case "<":
                return new Boolean(this.position, left.value < right.value)
            case "<=":
                return new Boolean(this.position, left.value <= right.value)
            case "!=":
                return new Boolean(this.position, left.value != right.value)
        }
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

    display(){
        return String(this.value)
    }
}

class Float extends Token{
    constructor(position, value){
        super(position)
        this.value = value
    }

    display(){
        if (this.check_for_float(this.value)){
            return String(this.value)
        }
        return String(this.value) + ".0"
    }
}

class Boolean extends Token{
    constructor(position, value){
        super(position)
        this.value = value
    }

    display(){
        return this.value ? "True" : "False"
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

// For generic keywords like const, global which don't need a unique object
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

    location(){
        return `${this.text}\n${' '.repeat(this.position)}^`
    }
}

class UnexpectedCharacterError extends Error {
    constructor(position, character) {
        super(position)
        this.character = character
    }

    display(){
        return ` ! ERROR\nUnexpected Character: '${this.character}'\n${this.location()}`
    }
}

class SyntaxError extends Error {
    constructor(token, description='') {
        super(token.position)
        this.token = token
        this.description = description
    }

    display(){
        return ` ! ERROR\nInvalid Syntax: ${this.description}\n${this.location()}`
    }
}

class MathError extends Error {
    constructor(token, description='') {
        super(token.position)
        this.token = token
        this.description = description
    }

    display(){
        return ` ! ERROR\nMath Error: ${this.description}\n${this.location()}`
    }
}

class IdentifierError extends Error{
    constructor(token, description='') {
        super(token.position)
        this.token = token
        this.description = description
    }

    display(){
        return ` ! ERROR\nIdentifier Error: '${this.token.name}' ${this.description}\n${this.location()}`
    }
}

class Lexer {
    constructor(program){
        this.program = program
        this.row = -1
        this.position = -1
        this.line = null
        this.character = null
        this.advance_line()
    }

    advance_line(){
        this.row += 1
        this.line = this.row == this.program.length ? null : this.program[this.line]
        this.position = -1
        this.continue()
    }

    continue(){
        this.position += 1
        this.character = this.position == this.line.length ? null : this.line[this.position]
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
            } else if (['=','<','>','!'].includes(this.character)){
                tokens.push(this.make_logical_operator())
                continue
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
            case "True":
                return new Boolean(position, true)
            case "False":
                return new Boolean(position, false)
            case "AND":
                return new And(position)
            case "OR":
                return new Or(position)
            default:
                return new Identifier(position, name)
        }
    }

    make_logical_operator(){
        let initialCharacter = this.character
        this.continue()
        if (this.character == '='){
            this.continue()
            return new LogicalOperator(this.position-2, initialCharacter+'=')
        }
        switch (initialCharacter){
            case '=':
                return new Equals(this.position-1)
            case '!':
                return new UnexpectedCharacterError(this.position-1, initialCharacter)
            default:
                return new LogicalOperator(this.position-1, initialCharacter)
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

    // Takes in an the classes as arguments and checks if current token is instance of the items
    check_instance() {
        for (let item of arguments){
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
        // Check if the first token is a binary operator
        if (this.token instanceof BinaryOperator){
            return new SyntaxError(this.token, "Expected literal")
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
        // Left over case is just an expression or a statement
        let result = this.statement_chain(this)
        return this.check_result(result) ? result : new SyntaxError(this.token, "Expected operator")
    }

    check_result(result){
        if (result instanceof Error || this.token == null){
            return true
        }
        return false
    }

    factor(self){
        if (self.check_instance(Integer, Float, Identifier)){
            let result = self.token
            self.continue()
            return result
        }
        let result = self.parse_brackets(self, LeftBracket, RightBracket, self.expression)
        if (result != null){
            return result
        }
        if (self.check_instance(Add)){ // Add unary operator
            let errorToken = self.token
            self.continue()
            if (self.token == null){
                return new SyntaxError(errorToken.position, "Incomplete input")
            }
            return self.factor(self)
        } 
        if (self.check_instance(Minus)){ // Minus unary operator
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
        let result = self.parse_binary_operator(self, self.term, [Add, Minus])
        if (self.check_instance(Integer, Float, Identifier)){
            return new SyntaxError(self.token, "Expected operator")
        }
        return result
    }

    half_statement(self){
        let bracketCheck = self.parse_brackets(self, LeftBracket, RightBracket, self.statement_chain)
        if (bracketCheck != null){
            return bracketCheck
        }
        if (self.token instanceof Identifier){
            let result = self.token.evaluate()
            if (result instanceof Boolean){
                self.continue()
                return result
            }
        }
        if (self.token instanceof Boolean){
            let result = self.token
            self.continue()
            return result
        }
        if (self.token instanceof BinaryOperator){
            return new SyntaxError(self.token, "Expected literal")
        }
        return self.expression(self)
    }

    statement(self){
        let left = self.half_statement(self)
        if (left instanceof Error || self.token == null){ // Check if just a normal expression and not a statement
            return left
        }
        let result = self.token
        if (!(result instanceof LogicalOperator)){ // Middle
            if (self.check_result(result)){
                return result
            }
            if (left instanceof Boolean){
                return left
            }
            return new SyntaxError(self.token, "Expected operator")
        }
        self.continue()
        if (self.token == null){
            return new SyntaxError(result, "Incomplete input")
        }
        let right = self.half_statement(self)
        if (right instanceof Error){
            return right
        }
        result.left = left
        result.right = right
        return result
    }

    statement_chain(self){
        return self.parse_binary_operator(self, self.statement, [And, Or])
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
        let right = self.statement_chain(self)
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
        while (self.token != null && self.check_instance(...tokens)){
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

    parse_brackets(self, start, end, nextFunction){
        let bracket = self.token
        if (bracket instanceof start){
            self.continue()
            let result = nextFunction(self)
            if (result instanceof Error){
                return result
            }
            if (self.token instanceof end){
                self.continue()
                return result
            }
            return new SyntaxError(bracket, "'(' was never closed")
        }
        return null
    }
}


class Shell {
    constructor() {
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
            console.log(tokens.display())
            return
        }
        let parsed = new Parser(tokens).parse()
        if (parsed instanceof Error){
            console.log(parsed.display())
            return
        }
        if (parsed == null){
            return
        }
        let evaluated = parsed.evaluate()
        if (evaluated != null){
            console.log(evaluated.display())
        }
        return
    }
}

class RunFile extends Shell{
    constructor(fileName){
        super()
        this.fileName = fileName
        this.program = this.get_plaintext()
    }

    get_plaintext(){
        try {
            return fs.readFileSync(this.fileName, 'utf8').split("\n")
          } catch (err) {
            console.error(err)
          }
    }

    main(){ 
        for (let line of this.program){
            this.run(line)
        }
    }
}

new RunFile("code.erl").main()
