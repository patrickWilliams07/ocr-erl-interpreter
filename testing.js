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
const { isArray } = require('util')
const DIGITS = [..."0123456789"]
const LETTERS = [..."qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM"]
let global = new SymbolTable()
let currentText = []

class Token {
    constructor(position, line){
        this.position = position
        this.line = line
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
    constructor(position, line){
        super(position, line)
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
    constructor(position, line){
        super(position, line)
    }
    
    evaluate(){
        let left = this.left.evaluate()
        let right = this.right.evaluate()
        let result = this.check_for_errors(left, right)
        if (result != null){
            return result
        }
        result = left.value + right.value
        return this.check_for_float(left, right, result) ? new Float(this.position, this.line, result) : new Integer(this.position, this.line, result)
    }
}

class Minus extends BinaryOperator{
    constructor(position, line){
        super(position, line)
    }
    
    evaluate(){
        let left = this.left.evaluate()
        let right = this.right.evaluate()
        let result = this.check_for_errors(left, right)
        if (result != null){
            return result
        }
        result = left.value - right.value
        return this.check_for_float(left, right, result) ? new Float(this.position, this.line, result) : new Integer(this.position, this.line, result)
    }
}

class Multiply extends BinaryOperator{
    constructor(position, line){
        super(position, line)
    }
    
    evaluate(){
        let left = this.left.evaluate()
        let right = this.right.evaluate()
        let result = this.check_for_errors(left, right)
        if (result != null){
            return result
        }
        result = left.value * right.value
        return this.check_for_float(left, right, result) ? new Float(this.position, this.line, result) : new Integer(this.position, this.line, result)
    }
}

class Divide extends BinaryOperator{
    constructor(position, line){
        super(position, line)
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
        return this.check_for_float(left, right, result) ? new Float(this.position, this.line, result) : new Integer(this.position, this.line, result)
    }
}

class Exponent extends BinaryOperator{
    constructor(position, line){
        super(position, line)
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
        return this.check_for_float(left, right, result) ? new Float(this.position, this.line, result) : new Integer(this.position, this.line, result)
    }
}

// =
class Equals extends BinaryOperator{
    constructor(position, line){
        super(position, line)
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
    constructor(position, line){
        super(position, line)
    }

    evaluate(){
        let left = this.left.evaluate()
        let right = this.right.evaluate()
        let result = this.check_for_errors(left, right)
        if (result != null){
            return result
        }
        return new Boolean(this.position, this.line, left.value && right.value)
    }
}

class Or extends BinaryOperator{
    constructor(position, line){
        super(position, line)
    }

    evaluate(){
        let left = this.left.evaluate()
        let right = this.right.evaluate()
        let result = this.check_for_errors(left, right)
        if (result != null){
            return result
        }
        return new Boolean(this.position, this.line, left.value || right.value)
    }
}

class LogicalOperator extends BinaryOperator{
    constructor(position, line, tag){
        super(position, line)
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
                return new Boolean(this.position, this.line, left.value == right.value)
            case ">":
                return new Boolean(this.position, this.line, left.value > right.value)
            case ">=":
                return new Boolean(this.position, this.line, left.value >= right.value)
            case "<":
                return new Boolean(this.position, this.line, left.value < right.value)
            case "<=":
                return new Boolean(this.position, this.line, left.value <= right.value)
            case "!=":
                return new Boolean(this.position, this.line, left.value != right.value)
        }
    }
}

class LeftBracket extends Token{
    constructor(position, line){
        super(position, line)
    }
}

class RightBracket extends Token{
    constructor(position, line){
        super(position, line)
    }
}

class Integer extends Token{
    constructor(position, line, value){
        super(position, line)
        this.value = value
    }

    display(){
        return String(this.value)
    }
}

class Float extends Token{
    constructor(position, line, value){
        super(position, line)
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
    constructor(position, line, value){
        super(position, line)
        this.value = value
    }

    display(){
        return this.value ? "True" : "False"
    }
}

class Identifier extends Token{
    constructor(position, line, name, constant=false){
        super(position, line)
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

// For generic keywords like const, global which don't need a unique object
class TemplateKeyword extends Token{
    constructor(position, line, tag){
        super(position, line)
        this.tag = tag
    }
}

class IfStatement extends Token{
    constructor(position, line){
        super(position, line)
        this.cases = []
        this.elseCase = null
    }

    get_case(){
        for (let ifCase of this.cases){
            let result = ifCase.statement.evaluate()
            if (result instanceof Error){
                return result
            }
            if (result.value){
                return ifCase.contents
            }
        }
        if (elseCase != null){
            return this.elseCase.contents
        }
        return null
    }
}

class IfCase extends Token{
    constructor(position, line){
        super(position, line)
        this.statement = null
        this.contents = []
    }
}

class ElseCase extends Token{
    constructor(position, line){
        super(position, line)
        this.contents = []
    }
}

class Error {
    constructor(position, line){
        this.position = position
        this.line = line + 1
        this.text = currentText[line]
    }

    location(){
        return `${this.text}\n${' '.repeat(this.position)}^`
    }
}

class UnexpectedCharacterError extends Error {
    constructor(position, line, character) {
        super(position, line)
        this.character = character
    }

    display(){
        return ` ! ERROR @line ${this.line}\nUnexpected Character: '${this.character}'\n${this.location()}`
    }
}

class SyntaxError extends Error {
    constructor(token, description='') {
        super(token.position, token.line)
        this.token = token
        this.description = description
    }

    display(){
        return ` ! ERROR @line ${this.line}\nInvalid Syntax: ${this.description}\n${this.location()}`
    }
}

class MathError extends Error {
    constructor(token, description='') {
        super(token.position, token.line)
        this.token = token
        this.description = description
    }

    display(){
        return ` ! ERROR @line ${this.line}\nMath Error: ${this.description}\n${this.location()}`
    }
}

class IdentifierError extends Error{
    constructor(token, description='') {
        super(token.position, token.line)
        this.token = token
        this.description = description
    }

    display(){
        return ` ! ERROR @line ${this.line}\nIdentifier Error: '${this.token.name}' ${this.description}\n${this.location()}`
    }
}

class Lexer {
    constructor(program){
        this.allPlaintext = program
        this.line = -1
        this.currentPlaintext = null
        this.position = -1
        this.character = null
        this.advance_line()
    }

    advance_line(){
        this.line += 1
        this.currentPlaintext = this.line == this.allPlaintext.length ? null : this.allPlaintext[this.line]
        this.position = -1
    }

    continue(){
        this.position += 1
        this.character = this.position == this.currentPlaintext.length ? null : this.currentPlaintext[this.position]
    }

    make_tokens(){
        let file = []
        while (this.currentPlaintext != null){
            this.continue()
            let result = this.make_tokens_line()
            if (result instanceof Error){
                return result
            }
            if (result.length >= 1){
                file.push(result)
            }
            this.advance_line()
        }
        return file
    }
    
    make_tokens_line(){
        let tokens = []
        while (this.character != null){
            if (this.character == ' ' || this.character == "\t"){
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
                tokens.push(new Add(this.position, this.line))
            } else if (this.character == '-') {
                tokens.push(new Minus(this.position, this.line))
            } else if (this.character == '*') {
                tokens.push(new Multiply(this.position, this.line))
            } else if (this.character == '/') {
                this.continue()
                if (this.character = '/'){ // Comment
                    return tokens
                }
                tokens.push(new Divide(this.position-1, this.line))
                continue
            } else if (this.character == '^') {
                tokens.push(new Exponent(this.position, this.line))
            } else if (['=','<','>','!'].includes(this.character)){
                tokens.push(this.make_logical_operator())
                continue
            } else if (this.character == '(') {
                tokens.push(new LeftBracket(this.position, this.line))
            } else if (this.character == ')') {
                tokens.push(new RightBracket(this.position, this.line))
            } else { // Not recognised
                return new UnexpectedCharacterError(this.position, this.line, this.character)
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
        return fullStops == 0 ? new Integer(position, this.line, Number(number.join(''))) : new Float(position, this.line, Number(number.join('')))
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
            case "True":
                return new Boolean(position,this.line, true)
            case "False":
                return new Boolean(position,this.line, false)
            case "AND":
                return new And(position, this.line)
            case "OR":
                return new Or(position, this.line)
            case "if":
                return new IfStatement(position, this.line)
            case "elif":
                return new IfCase(position, this.line)
            case "else":
                return new ElseCase(position, this.line)
            case "const":
            case "then":
            case "endif":
                return new TemplateKeyword(position, this.line, name)
            default:
                return new Identifier(position, this.line, name)
        }
    }

    make_logical_operator(){
        let initialCharacter = this.character
        this.continue()
        if (this.character == '='){
            this.continue()
            return new LogicalOperator(this.position-2, this.line, initialCharacter+'=')
        }
        switch (initialCharacter){
            case '=':
                return new Equals(this.position-1, this.line)
            case '!':
                return new UnexpectedCharacterError(this.position-1, this.line, initialCharacter)
            default:
                return new LogicalOperator(this.position-1, this.line, initialCharacter)
        }
    }
}

class Parser {
    constructor(tokens){
        this.allTokens = tokens
        this.line = -1
        this.currentTokens = null
        this.position = -1
        this.character = null
    }

    advance_line(){
        this.line += 1
        this.currentTokens = this.line == this.allTokens.length ? null : this.allTokens[this.line]
        this.position = -1
    }

    continue(){
        this.position += 1
        this.token = this.position == this.currentTokens.length ? null : this.currentTokens[this.position]
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

    parse_next(){
        this.advance_line()
        if (this.currentTokens == null){
            return null
        }
        this.continue()
        return this.parse()
    }

    parse(){
        // Check if there are no tokens
        if (this.token == null){
            return null
        }
        // Checks if an if statement is being built
        if (this.token instanceof IfStatement){
            return this.build_if_chain(this)
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

    if_statement(self, ifToken){
        self.continue() // Continues past initial token
        let result = self.statement_chain(self) // Gets statement to check
        if (result instanceof Error){
            return result
        }
        if (self.token instanceof TemplateKeyword){
            if (self.token.tag == "then"){ // Checks if line finishes witt then
                ifToken.statement = result
                self.continue()
                if (self.token == null){
                    return ifToken
                }
                return new SyntaxError(self.token, "Unexpected token after 'then") // Tokens after then
            }
        }
        if (self.token == null){ // No then is included, points to if statement
            return new SyntaxError(ifToken, "If statement must end with 'then")
        } // No then and extra tokens, points to extra tokens
        return new SyntaxError(self.token, "Expected 'then")
    }

    build_if_chain(self){
        let mainStatement = self.token // Stores the entire chain
        let currentIfStatement = self.if_statement(self, new IfCase(self.token.position, self.token.line)) // Creating first if case
        if (currentIfStatement instanceof Error){
            return currentIfStatement
        }
        self.advance_line() // Advances line
        while(self.currentTokens != null){
            self.continue()
            if (self.token instanceof IfCase){ // Checkes for elif
                mainStatement.cases.push(currentIfStatement) // Pushes old if case
                currentIfStatement = self.if_statement(self, self.token) // Creates new if case
                if (currentIfStatement instanceof Error){
                    return currentIfStatement
                }
            } else if (self.token instanceof ElseCase){
                mainStatement.cases.push(currentIfStatement) // Pushes old if case
                currentIfStatement = self.token
                self.advance_line()
                while(self.currentTokens != null){ // Loops through remaining tokens
                    self.continue()
                    if (self.token instanceof TemplateKeyword){ // Check for endif
                        if (self.token.tag == "endif"){
                            mainStatement.elseCase = currentIfStatement // Adds else case
                            return mainStatement
                        }
                    }
                    let result = self.parse() // Adds the asts
                    if (result instanceof Error){
                        return result
                    }
                    currentIfStatement.contents.push(result)
                    self.advance_line()
                }
                return new SyntaxError(self.mainStatement, "Expected endif at end") // Not complete
            } else if (self.token instanceof TemplateKeyword){ // Check for endif
                if (self.token.tag == "endif"){
                    mainStatement.cases.push(currentIfStatement) // Pushes old if case
                    return mainStatement
                } // Otherwise do defauly
                let result = self.parse()
                if (result instanceof Error){
                    return result
                }
                currentIfStatement.contents.push(result)
            } else {
                let result = self.parse() // Dafault
                if (result instanceof Error){
                    return result
                }
                currentIfStatement.contents.push(result) //Add AST to the currents contents
            }
            self.advance_line()
        }
        return new SyntaxError(mainStatement, "Expected endif at end") // Not complete
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

class Interpreter { 
    constructor(){
        this.plaintext = null
        this.tokens = []
        this.have_tokens = false
    }

    get_plaintext_from_file(fileName){
        try {
            this.plaintext = fs.readFileSync(fileName, 'utf8').split("\n")
            currentText = this.plaintext
        } catch (err) {
            console.error(err)
        }
        this.have_tokens = false
    }

    set_plaintext_manually(string){
        this.plaintext = string.split("\n")
        currentText = this.plaintext
        this.have_tokens = false
    }

    make_tokens(){
        let result = new Lexer(this.plaintext).make_tokens()
        if (result instanceof Error){
            return result
        }
        this.tokens = result
        this.have_tokens = true
    }

    execute_asts(asts){
        if (!Array.isArray(asts)){
            asts = [asts]
        }
        for (let ast of asts){
            if (ast instanceof Error){
                console.log(ast.display())
                return 1
            }
            if (ast == null){
                continue
            }
            let evaluated = ast.evaluate()
            if (evaluated != null){
                console.log(evaluated.display())
            }
            if (evaluated instanceof Error){
                return 1
            }
        }
        return 0
    }

    run(){
        if (!this.have_tokens){
            let result = this.make_tokens()
            if (result instanceof Error){
                console.log(result.display())
                return 1
            }
        }
        let parser = new Parser(this.tokens)
        let ast = parser.parse_next()
        while (ast != null){
            if (ast instanceof IfStatement){
                ast = ast.get_case()
            }
            let result = this.execute_asts(ast)
            if (result == 1){
                return 1
            }
            ast = parser.parse_next()
        }
        return 0
    }

    shell(){
        this.set_plaintext_manually(prompt(" ERL ==> "))
        while (this.plaintext != "QUIT()"){
            this.run()
            this.set_plaintext_manually(prompt(" ERL ==> "))
        }
    }

    run_file(fileName){
        this.get_plaintext_from_file(fileName)
        let code = this.run()
        console.log(`\nExited with code ${code}`)
    }
}

let commandLineArguments = process.argv
main = new Interpreter()
if (arguments.length > 2){
    main.run_file(commandLineArguments[2])
}
main.shell()
