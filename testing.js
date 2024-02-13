////////////////
// SYMBOL TABLE
////////////////

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
        this.table.push(new Symbol(token))
        return this.table[this.table.length - 1]
    }
}

class Symbol {
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

////////////////
// GLOBALS
////////////////

const prompt = require('prompt-sync')()
const fs = require('fs')
const DIGITS = [..."0123456789"]
const LETTERS = [..."qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM"]
let global = new SymbolTable()
let currentText = []

////////////////
// TOKEN
////////////////

class Token {
    constructor(position, line){
        this.position = position
        this.line = line
    }
}

////////////////
// ARITHMETIC
////////////////

class BinaryOperator extends Token{
    constructor(position, line){
        super(position, line)
        this.left = null
        this.right = null
        this.leftValue = null
        this.rightValue = null
    }

    evaluate(){
        this.leftValue = this.left.evaluate()
        this.rightValue = this.right.evaluate()
        if (this.leftValue instanceof Error){
            return this.leftValue
        }
        if (this.rightValue instanceof Error){
            return this.rightValue
        }
        return this.calculate()
    }

    // Ensures the left data type is left argument, and right data type is right argument
    strict_type_check(leftType, rightType){
        if (this.leftValue instanceof leftType && this.rightValue instanceof rightType){
            return true
        }
        return false
    }

    // Ensures both left and right are instances of one of the arguments each
    loose_type_check(){
        let leftDone = false
        let rightDone = false
        for (let type of arguments){
            if (this.leftValue instanceof type){
                leftDone = true
            }
            if (this.rightValue instanceof type){
                rightDone = true
            }
        }
        return leftDone && rightDone
    }

    // Ensures either left or right are instances of one of the arguments
    contains_type(){
        for (let type of arguments){
            if (this.leftValue instanceof type || this.rightValue instanceof type){
                return true
            }
        }
        return false
    }
}

class Add extends BinaryOperator{
    constructor(position, line){
        super(position, line)
    }

    calculate(){
        if (this.contains_type(FloatType) && this.loose_type_check(FloatType, IntegerType)){ // Contains at least one float with potential integers
            return new FloatType(this.position, this.line, this.get_result()) // Definitely a float return
        }
        if (this.strict_type_check(IntegerType, IntegerType)){ // Contains two integers
            return new IntegerType(this.position, this.line, this.get_result()) // Definitely an integer return for addition
        }
        if (this.strict_type_check(StringType, StringType)){ // Contains two strings
            return new StringType(this.position, this.line, this.get_result()) // Concatenation
        } // ERRORS
        if (this.leftValue instanceof StringType){ // String + ?
            return new TypeError(this, `Cannot concatenate type ${this.rightValue.type_to_string()} with String, expected String`)
        } 
        if (this.leftValue instanceof IntegerType || this.rightValue instanceof FloatType){ // Number + ?
            return new TypeError(this, `Cannot add type ${this.rightValue.type_to_string()} to ${this.leftValue.type_to_string()}, expected Integer or Float`)
        } // ELSE
        return new TypeError(this, `Cannot combine types ${this.leftValue.type_to_string()} and ${this.rightValue.type_to_string()}`)
    }

    get_result = () => this.leftValue.value + this.rightValue.value
}

class Minus extends BinaryOperator{
    constructor(position, line){
        super(position, line)
    }
    
    calculate(){
        if (this.contains_type(FloatType) && this.loose_type_check(FloatType, IntegerType)){ // Contains at least one float with potential integers
            return new FloatType(this.position, this.line, this.get_result()) // Definitely a float return
        }
        if (this.strict_type_check(IntegerType, IntegerType)){ // Contains two integers
            return new IntegerType(this.position, this.line, this.get_result()) // Definitely an integer return for addition
        } // ERRORS
        return new TypeError(this, `Cannot subtract type ${this.rightValue.type_to_string()} from ${this.leftValue.type_to_string()}, expected Integers or Floats`)
    }

    get_result = () => this.leftValue.value - this.rightValue.value
}

class Multiply extends BinaryOperator{
    constructor(position, line){
        super(position, line)
    }
    
    calculate(){
        if (this.contains_type(FloatType) && this.loose_type_check(FloatType, IntegerType)){ // Contains at least one float with potential integers
            return new FloatType(this.position, this.line, this.get_result()) // Definitely a float return
        }
        if (this.strict_type_check(IntegerType, IntegerType)){ // Contains two integers
            return new IntegerType(this.position, this.line, this.get_result()) // Definitely an integer return for addition
        } // ERRORS
        return new TypeError(this, `Cannot mutltiply type ${this.leftValue.type_to_string()} with ${this.rightValue.type_to_string()}, expected Integers or Floats`)
    }

    get_result = () => this.leftValue.value * this.rightValue.value
}

class Divide extends BinaryOperator{
    constructor(position, line){
        super(position, line)
    }
    
    calculate(){
        console.log(this.contains_type(FloatType), this.loose_type_check(FloatType, IntegerType))
        if (this.rightValue.value === 0){
            return new EvaluationError(this.leftValue, "Cannot divide by zero")
        }
        if (this.contains_type(FloatType) && this.loose_type_check(FloatType, IntegerType)){ // Contains at least one float with potential integers
            return new FloatType(this.position, this.line, this.get_result())  // Definitely a float return
        }
        if (this.strict_type_check(IntegerType, IntegerType)){ // Contains two integers
            let result = this.get_result() // Must check as can produce a float result
            return String(result).includes('.') ? new FloatType(this.position, this.line, result) : new IntegerType(this.position, this.line, result)
        } // ERRORS
        return new TypeError(this, `Cannot divide type ${this.rightValue.type_to_string()} by ${this.leftValue.type_to_string()}, expected Integes or Floats`)
    }

    get_result = () => this.leftValue.value / this.rightValue.value
}

class Exponent extends BinaryOperator{
    constructor(position, line){
        super(position, line)
    }
    
    calculate(){
        if (isNaN(this.get_result())){
            return new EvaluationError(this.leftValue, "Cannot raise a negative number to this power")
        }
        if (this.contains_type(FloatType) && this.loose_type_check(FloatType, IntegerType)){ // Contains at least one float with potential integers
            return new FloatType(this.position, this.line, this.get_result())  // Definitely a float return
        }
        if (this.strict_type_check(IntegerType, IntegerType)){ // Contains two integers
            let result = this.get_result() // Must check as can produce a float result
            return String(result).includes('.') ? new FloatType(this.position, this.line, result) : new IntegerType(this.position, this.line, result)
        } // ERRORS
        return new TypeError(this, `Cannot divide type ${this.rightValue.type_to_string()} by ${this.leftValue.type_to_string()}, expected Integers or Floats`)
    }

    get_result = () => this.leftValue.value ** this.rightValue.value
}

class Modulus extends BinaryOperator{
    constructor(position, line){
        super(position, line)
    }
    
    calculate(){
        if (this.rightValue.value === 0){
            return new EvaluationError(this.leftValue, "Cannot take moduluo by zero")
        }
        if (this.contains_type(FloatType) && this.loose_type_check(FloatType, IntegerType)){ // Contains at least one float with potential integers
            return new FloatType(this.position, this.line, this.get_result()) // Definitely a float return
        }
        if (this.strict_type_check(IntegerType, IntegerType)){ // Contains two integers
            return new IntegerType(this.position, this.line, this.get_result()) // Definitely an integer return
        } // ERRORS
        return new TypeError(this, `Cannot take modulus of type ${this.leftValue.type_to_string()} modulo ${this.rightValue.type_to_string()}, expected Integers or Floats`)
    }

    get_result = () => this.leftValue.value % this.rightValue.value
}

class Quotient extends BinaryOperator{
    constructor(position, line){
        super(position, line)
    }
    
    calculate(){
        if (this.rightValue.value === 0){
            return new EvaluationError(this.leftValue, "Cannot do quotient division by zero")
        }
        if (this.contains_type(FloatType) && this.loose_type_check(FloatType, IntegerType)){ // Contains at least one float with potential integers
            return new FloatType(this.position, this.line, this.get_result()) // Definitely a float return
        }
        if (this.strict_type_check(IntegerType, IntegerType)){ // Contains two integers
            return new IntegerType(this.position, this.line, this.get_result()) // Definitely an integer return
        } // ERRORS
        return new TypeError(this, `Cannot take the quotient of type ${this.leftValue.type_to_string()} and ${this.rightValue.type_to_string()}, expected Integers or Floats`)
    }

    get_result = () => Math.floor(this.leftValue.value / this.rightValue.value)
}

////////////////
// EQUALS
////////////////

class Equals extends BinaryOperator{
    constructor(position, line){
        super(position, line)
    }

    evaluate(){
        this.leftValue = this.left.assign()
        this.rightValue = this.right.evaluate()
        if (this.leftValue instanceof Error){
            return this.leftValue
        }
        if (this.rightValue instanceof Error){
            return this.rightValue
        }
        return this.leftValue.set(this.rightValue)
    }
}

////////////////
// LOGICAL
////////////////

class And extends BinaryOperator{
    constructor(position, line){
        super(position, line)
    }

    calculate(){
        if (this.strict_type_check(BooleanType, BooleanType)){ // Contains two Booleans
            return new BooleanType(this.position, this.line, this.get_result()) // Expected result
        } // ERRORS
        return new TypeError(this, `Cannot use AND on type ${this.rightValue.type_to_string()} with ${this.leftValue.type_to_string()}, expected Booleans`)
    }

    get_result = () => this.leftValue.value && this.rightValue.value
}

class Or extends BinaryOperator{
    constructor(position, line){
        super(position, line)
    }

    calculate(){
        if (this.strict_type_check(BooleanType, BooleanType)){ // Contains two Booleans
            return new BooleanType(this.position, this.line, this.get_result()) // Expected result
        } // ERRORS
        return new TypeError(this, `Cannot use OR on type ${this.rightValue.type_to_string()} with ${this.leftValue.type_to_string()}, expected Booleans`)
    }

    get_result = () => this.leftValue.value || this.rightValue.value
}

class Not extends Token{
    constructor(position, line){
        super(position, line)
        this.child = null
    }

    evaluate(){
        let childValue = this.child.evaluate()
        if (childValue instanceof Error){
            return childValue
        }
        if (childValue instanceof BooleanType){
            return new BooleanType(this.position, this.line, !childValue.value)
        }
        return new TypeError(this, `Cannot use NOT on type ${childValue.type_to_string()}, expected Boolean`)
    }
}

class ComparisonOperator extends BinaryOperator{
    constructor(position, line, tag){
        super(position, line)
        this.tag = tag
    }

    calculate(){
        if (this.loose_type_check(IntegerType, FloatType) || this.strict_type_check(StringType, StringType)){ // Contains two Booleans
            return new BooleanType(this.position, this.line, this.get_result()) // Expected result
        }
        if (this.strict_type_check(BooleanType, BooleanType)){
            if (this.tag == "==" || this.tag == "!="){
                return new BooleanType(this.position, this.line, this.get_result())
            }
            return new TypeError(this, `Cannot compare two Booleans with comparator '${this.tag}', only '==' or '!='`)
        }
        // ERRORS
        return new TypeError(this, `Cannot compare type ${this.rightValue.type_to_string()} against ${this.leftValue.type_to_string()}`)
    }

    get_result(){
        switch (this.tag){
            case "==":
                return this.leftValue.value == this.rightValue.value
            case ">":
                return this.leftValue.value > this.rightValue.value
            case ">=":
                return this.leftValue.value >= this.rightValue.value
            case "<":
                return this.leftValue.value < this.rightValue.value
            case "<=":
                return this.leftValue.value <= this.rightValue.value
            case "!=":
                return this.leftValue.value != this.rightValue.value
        }
    }
}

////////////////
// DATA TYPES
////////////////

class DataType extends Token{
    constructor(position, line, value){
        super(position, line)
        this.value = value
    }

    evaluate() {
        return this
    }
}

class IntegerType extends DataType{
    constructor(position, line, value){
        super(position, line, value)
    }

    display(){
        return String(this.value)
    }

    type_to_string = () => "Integer"

    cast_to_type(type){ // FROM INTEGERS
        switch (type){
            case IntegerType:
                return this
            case FloatType:
                return new FloatType(this.position, this.line, this.value)
            case BooleanType: // true when not 0, false when 0
                return new BooleanType(this.position, this.line, this.value != 0)
            case StringType:
                return new StringType(this.position, this.line, this.display())
        }
    }
}

class FloatType extends DataType{
    constructor(position, line, value){
        super(position, line, value)
    }

    display(){
        if (String(this.value).includes('.')){
            return String(this.value)
        }
        return String(this.value) + ".0"
    }
    
    type_to_string = () => "Float"

    cast_to_type(type){ // FROM FLOAT
        switch (type){
            case IntegerType:
                return new IntegerType(this.position, this.line, Math.floor(this.value))
            case FloatType:
                return this
            case BooleanType: // true when not 0, false when 0
                return new BooleanType(this.position, this.line, this.value != 0)
            case StringType:
                return new StringType(this.position, this.line, this.display())
        }
    }
}

class BooleanType extends DataType{
    constructor(position, line, value){
        super(position, line, value)
    }

    display(){
        return this.value ? "True" : "False"
    }

    type_to_string = () => "Boolean"

    cast_to_type(type){ // FROM BOOLEAN
        switch (type){
            case IntegerType:
            case FloatType: // 1 when true, 0 when false
                return new type(this.position, this.line, this.value ? 1 : 0)
            case BooleanType:
                return this
            case StringType:
                return new StringType(this.position, this.line, this.display())
        }
    }
}

class StringType extends DataType{
    constructor(position, line, value){
        super(position, line, value)
    }

    display(){
        return this.value
    }

    type_to_string = () => "String"

    cast_to_type(type){ // FROM STRING
        switch (type){
            case IntegerType: // Can be converted to a number, no full stops
                if (isNaN(Number(this.value)) || this.value.includes('.')){
                    return new TypeError(this, `Cannot cast ${this.value} to type Integer`)
                }
                return new IntegerType(this.position, this.line, Number(this.value))
            case FloatType: // Can be converted to a number
                if (isNaN(Number(this.value))){
                    return new TypeError(this, `Cannot cast ${this.value} to type Float`)
                }
                return new FloatType(this.position, this.line, Number(this.value))
            case BooleanType: // "True" or "False" are accepted, rest are errors
                switch (this.value){
                    case "True":
                        return new BooleanType(this.position, this.line, true)
                    case "False":
                        return new BooleanType(this.position, this.line, false)
                    default:
                        return new TypeError(this, `Cannot cast ${this.value} to type Float, expected "True" or "False"`)
                }
            case StringType:
                return this
        }
    }
}

////////////////
// MISCELLANEOUS
////////////////

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

// class Call extends Token{
//     constructor(position, line)
// }

// For generic keywords like const, global which don't need a unique object
class TemplateKeyword extends Token{
    constructor(position, line, tag){
        super(position, line)
        this.tag = tag
    }
}

////////////////
// IF STATEMENTS
////////////////

class IfStatement extends Token{
    constructor(position, line){
        super(position, line)
        this.cases = []
        this.elseCase = null
    }

    evaluate(){
        for (let ifCase of this.cases){
            let result = ifCase.condition.evaluate()
            if (result instanceof Error){
                return result
            }
            if (!(result instanceof BooleanType)){
                return new TypeError(result, `Condition must be type Boolean, not ${result.type_to_string()}`)
            }
            if (result.value === true){
                return ifCase.contents
            }
        }
        if (this.elseCase != null){
            return this.elseCase.contents
        }
        return null
    }
}

class IfCase extends Token{
    constructor(position, line){
        super(position, line)
        this.condition = null
        this.contents = []
    }
}

class ElseCase extends Token{
    constructor(position, line){
        super(position, line)
        this.contents = []
    }
}

////////////////
// LOOPS
////////////////

class Loop extends Token{
    constructor(position, line){
        super(position, line)
        this.contents = []
    }

    evaluate(){
        return this.contents
    }
}

class While extends Loop{
    constructor(position, line){
        super(position, line)
        this.condition = null
    }

    evaluate_condition(){
        let condition = this.condition.evaluate()
        if (condition instanceof Error){
            return condition
        }
        if (!(condition instanceof BooleanType)){
            return new TypeError(condition, `Condition must be type Boolean, not ${condition.type_to_string()}`)
        }
        return condition.value
    }

    reset = () => null
}

class Do extends Loop{
    constructor(position, line){
        super(position, line)
        this.condition = null
        this.firstPassComplete = false
    }

    evaluate_condition(){
        if (!this.firstPassComplete){
            this.firstPassComplete = true
            return true
        }
        let condition = this.condition.evaluate()
        if (condition instanceof Error){
            return condition
        }
        if (!(condition instanceof BooleanType)){
            return new TypeError(condition, `Condition must be type Boolean, not ${condition.type_to_string()}`)
        }
        return !condition.value
    }

    reset(){
        this.firstPassComplete = false
    }
}

class For extends Loop{
    constructor(position, line){
        super(position, line)
        this.firstPassComplete = false
        this.variable = null
        this.variableValue = null
        this.assignment = null
        this.finish = null
        this.finishValue = null
        this.step = null
        this.stepValue = null
        this.increasing = null
    }

    first_pass(){
        let assignment = this.assignment.evaluate()
        if (assignment instanceof Error){
            return assignment
        }
        let result = this.variable.evaluate()
        if (!(result instanceof IntegerType)){
            return new TypeError(result, "Starting value is not an Integer")
        }
        this.variableValue = new IntegerType(this.variable.position, this.variable.line, result.value)
        this.finishValue = this.finish.evaluate()
        if (this.finishValue instanceof Error){
            return this.finishValue
        }
        if (!(this.finishValue instanceof IntegerType)){
            return new TypeError(this.finishValue, "Final value is not an Integer")
        }
        this.stepValue = this.step.evaluate()
        if (this.stepValue instanceof Error){
            return this.stepValue
        }
        if (!(this.stepValue instanceof IntegerType)){
            return new TypeError(this.stepValue, "Final value is not an Integer")
        }
        if (this.variableValue.value <= this.finishValue.value && this.stepValue.value > 0){
            this.increasing = true
        } else if (this.variableValue.value >= this.finishValue.value && this.stepValue.value < 0){
            this.increasing = false
        } else if (this.stepValue.value == 0){
            return new EvaluationError(this.step, "Step must have non-zero value")
        } else {
            return new EvaluationError(this.step, "Step value must align with bounds of for loop")
        }
        this.firstPassComplete = true
    }

    evaluate_condition(){
        let newValue
        if (this.firstPassComplete){ //increasing value
            newValue = this.variableValue.value + this.stepValue.value
        } else {
            let result = this.first_pass()
            if (result instanceof Error){
                return result
            }
            newValue = this.variableValue.value
        }
        let condition = this.increasing ? newValue <= this.finishValue.value : newValue >= this.finishValue.value
        if (condition){ // only change identifier if another loop will occur
            this.variableValue.value = newValue
            this.variable.assign().set(this.variableValue)
        }
        return condition
    }

    reset(){
        this.firstPassComplete = false
    }
}

////////////////
// ERRORS
////////////////

class Error {
    constructor(position, line){
        this.position = position
        this.line = line + 1
        this.text = currentText[line]
    }

    location(){
        return `${this.text}\n${' '.repeat(this.position)}^`
    }

    display(){
        return "error"
    }
}

class LexicalError extends Error {
    constructor(position, line, description='') {
        super(position, line)
        this.description = description
    }

    // display(){
    //     return ` ! ERROR @line ${this.line}\nLexical Error: ${this.description}\n${this.location()}`
    // }
}

class SyntaxError extends Error {
    constructor(token, description='') {
        super(token.position, token.line)
        this.token = token
        this.description = description
    }

    // display(){
    //     return ` ! ERROR @line ${this.line}\nInvalid Syntax: ${this.description}\n${this.location()}`
    // }
}

class EvaluationError extends Error {
    constructor(token, description='') {
        super(token.position, token.line)
        this.token = token
        this.description = description
    }

    // display(){
    //     return ` ! ERROR @line ${this.line}\nEvaluation Error: ${this.description}\n${this.location()}`
    // }
}

class IdentifierError extends Error{
    constructor(token, description='') {
        super(token.position, token.line)
        this.token = token
        this.description = description
    }

    // display(){
    //     return ` ! ERROR @line ${this.line}\nIdentifier Error: '${this.token.name}' ${this.description}\n${this.location()}`
    // }
}

class TypeError extends Error{
    constructor(token, description='') {
        super(token.position, token.line)
        this.token = token
        this.description = description
    }

    // display(){
    //     return ` ! ERROR @line ${this.line}\nType Error: ${this.description}\n${this.location()}`
    // }
}

////////////////
// LEXER
////////////////

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
            } else if (this.character == '"' || this.character == "'"){
                let string = this.make_string()
                if (string instanceof Error){
                    return string
                }
                tokens.push(string)
            } else if (this.character == '+') {
                tokens.push(new Add(this.position, this.line))
            } else if (this.character == '-') {
                tokens.push(new Minus(this.position, this.line))
            } else if (this.character == '*') {
                tokens.push(new Multiply(this.position, this.line))
            } else if (this.character == '/') {
                this.continue()
                if (this.character == '/'){ // Comment
                    return tokens
                }
                tokens.push(new Divide(this.position-1, this.line))
                continue
            } else if (this.character == '^') {
                tokens.push(new Exponent(this.position, this.line))
            } else if (['=','<','>','!'].includes(this.character)){
                tokens.push(this.make_logical_operator())
                continue
            } else if (['(', ')',','].includes(this.character)){
                tokens.push(new TemplateKeyword(this.position, this.line, this.character))
            } else { // Not recognised
                return new LexicalError(this.position, this.line, `Unexpected character '${this.character}'`)
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
                    return new LexicalError(this.position, this.line, "Only expected one '.' to create Float")
                }
            }
            this.continue()
        }
        return fullStops == 0 ? new IntegerType(position, this.line, Number(number.join(''))) : new FloatType(position, this.line, Number(number.join('')))
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
            case "MOD":
                return new Modulus(position, this.line)
            case "DIV":
                return new Quotient(position, this.line)
            case "True":
                return new BooleanType(position, this.line, true)
            case "False":
                return new BooleanType(position, this.line, false)
            case "AND":
                return new And(position, this.line)
            case "OR":
                return new Or(position, this.line)
            case "NOT":
                return new Not(position, this.line)
            case "if":
                return new IfStatement(position, this.line)
            case "elseif":
                return new IfCase(position, this.line)
            case "else":
                return new ElseCase(position, this.line)
            case "while":
                return new While(position, this.line)
            case "do":
                return new Do(position, this.line)
            case "for":
                return new For(position, this.line)
            case "const":
            case "then":
            case "endif":
            case "endwhile":
            case "until":
            case "to":
            case "step":
            case "next":
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
            return new ComparisonOperator(this.position-2, this.line, initialCharacter+'=')
        }
        switch (initialCharacter){
            case '=':
                return new Equals(this.position-1, this.line)
            case '!':
                return new LexicalError(this.position-1, this.line, "Unexpected character '!'")
            default:
                return new ComparisonOperator(this.position-1, this.line, initialCharacter)
        }
    }

    make_string(){
        let string = []
        let position = this.position
        let quotationMark = this.character
        this.continue()
        while (this.character != quotationMark && this.character != null){
            string.push(this.character)
            this.continue()
        }
        return this.character == null ? new LexicalError(position, this.line, "Unclosed string") :new StringType(position, this.line, string.join(''))
    }
}

////////////////
// PARSER
////////////////

class Parser {
    constructor(tokens){
        this.allTokens = tokens // All of the tokens in the program in an 2D array
        this.line = -1  // The current index of tokens in the array
        this.currentTokens = null // The corresponding line of tokens in an array
        this.position = -1 // The current position in the line
        this.token = null // The corresponding token for the position
        this.previous = null // The previous token
    }

    advance_line(){
        this.line += 1
        this.currentTokens = this.line == this.allTokens.length ? null : this.allTokens[this.line]
        this.position = -1
    }

    continue(){
        this.position += 1
        this.previous = this.token
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

    check_tag(){
        if (!(this.token instanceof TemplateKeyword)){
            return false
        }
        for (let item of arguments){
            if (this.token.tag == item){
                return true
            }
        }
        return false
    }

    check_binary_operator(){
        if (this.token instanceof BinaryOperator){
            if (this.token instanceof Add || this.token instanceof Minus){
                return false
            }
            return true
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
        // Checks if it a while loop
        if (this.token instanceof While){
            let result = this.build_while_loop(this)
            return this.check_result(result) ? result : new SyntaxError(this.token, "Expeceted nothing to follow 'endwhile'")
        }
        // Checks if a do until loop
        if (this.token instanceof Do){
            return this.build_do_loop(this)
        }
        // Check if a for loop
        if (this.token instanceof For){
            return this.build_for_loop(this)
        }
        // Checks if an if statement is being built
        if (this.token instanceof IfStatement){
            let result = this.build_if_chain(this)
            return this.check_result(result) ? result : new SyntaxError(this.token, "Expeceted nothing to follow endif")
        }
        // Checks if elif or else without if statement
        if (this.check_instance(IfCase, ElseCase)){
            return new SyntaxError(this.token, "Needs to follow 'if' statement")
        }
        // Check if the first token is a binary operator
        if (this.check_binary_operator()){
            return new SyntaxError(this.token, "Expected literal")
        }
        // Check if there is a constant assignment
        if (this.check_tag("const")){
            let result = this.assignment(this)
                    return this.check_result(result) ? result : new SyntaxError(this.token, "Expected operator")
        }
        // Check if elseif or endif is used not at end of line
        if (this.check_tag("endif", "elseif")){
            return new SyntaxError(this.token, "Needs to follow 'if' statement")
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
        if (self.check_instance(DataType, Identifier)){
            let result = self.token
            self.continue()
            return result
        }
        if (self.check_tag('(')){
            return self.parse_brackets(self, ')', self.statement_chain)
        }
        if (self.check_instance(Add)){ // Add unary operator
            self.continue()
            if (self.token == null){
                return new SyntaxError(self.previous, "Incomplete input")
            }
            return self.factor(self)
        } 
        if (self.check_instance(Minus)){ // Minus unary operator
            self.continue()
            if (self.token == null){
                return new SyntaxError(self.previous, "Incomplete input")
            }
            let result = self.factor(self)
            if (result instanceof Error){
                return result
            }
            result.value = -result.value
            return result
        } // Two operators in a row
        return new SyntaxError(self.token, "Expected literal")
    }

    exponent(self){
        return self.parse_binary_operator(self, self.factor, [Exponent])
    }

    term(self){
        return self.parse_binary_operator(self, self.exponent, [Multiply, Divide, Modulus, Quotient])
    }

    expression(self){
        let result = self.parse_binary_operator(self, self.term, [Add, Minus])
        if (self.check_instance(IntegerType, FloatType, Identifier)){
            return new SyntaxError(self.token, "Expected operator")
        }
        return result
    }

    statement(self){
        if (this.check_binary_operator()){ // starts with binary operator
            return new SyntaxError(self.token, "Expected literal")
        }
        let left = self.expression(self) //left hand side
        if (left instanceof Error || !(self.token instanceof ComparisonOperator)){ 
            return left // returns if error or next is not comparison
        }
        let result = self.token // middle
        self.continue()
        if (self.token == null){ // nothing after comparison
            return new SyntaxError(result, "Incomplete input")
        }
        if (this.check_binary_operator()){ // starts with binary operator
            return new SyntaxError(self.token, "Expected literal")
        }
        let right = self.expression(self) //right hand side
        if (right instanceof Error){
            return right
        }
        result.left = left
        result.right = right
        return result // returns comparison
    }

    not_statement(self){
        if (self.token instanceof Not){
            let notToken = self.token
            self.continue()
            if (self.token == null){
                return new SyntaxError(self.previous, "Incomplete input")
            }
            let result = self.not_statement(self)
            if (result instanceof Error){
                return result
            }
            notToken.child = result
            return notToken
        }
        return self.statement(self)
    }

    statement_chain(self){
        return self.parse_binary_operator(self, self.not_statement, [And, Or])
    }

    assignment(self){
        let tag = null
        if (self.check_tag("const")){
            tag = "const"
            self.continue()
        }
        let variable = self.token
        if (!(variable instanceof Identifier)){
            return new SyntaxError(variable, "Expected identifier")
        }
        if (tag == "const"){
            variable = new Identifier(variable.position, variable.line, variable.name, true)
        }
        self.continue()
        let equals = self.token
        if (equals == null){
            return new SyntaxError(variable, "Expected '=' to follow identifier")
        }
        if (!(equals instanceof Equals)){
            return new SyntaxError(equals, "Expected equals")
        }
        self.continue()
        if (self.token == null){
            return new SyntaxError(equals, "Expected expression to follow '='")
        }
        equals.right = self.statement_chain(self)
        if (equals.right instanceof Error){
            return equals.right
        }
        equals.left = variable
        return equals
    }

    if_statement(self, ifToken){
        self.continue() // Continues past initial token
        if (self.token == null){
            return new SyntaxError(ifToken, "Expected condition after 'if")
        }
        let result = self.statement_chain(self) // Gets statement to check
        if (result instanceof Error){
            return result
        }
        if (self.check_tag("then")){ // Checks if line finishes with then
            ifToken.condition = result
            self.continue()
            if (self.token == null){
                return ifToken
            }
            return new SyntaxError(self.token, "Unexpected token after 'then'") // Tokens after then
        }
        return new SyntaxError(self.previous, "Expected 'then")
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
                    if (self.check_tag("endif")){ // Check for endif
                        mainStatement.elseCase = currentIfStatement // Adds else case
                        this.continue()
                        return mainStatement
                    }
                    let result = self.parse() // Adds the asts
                    if (result instanceof Error){
                        return result
                    }
                    currentIfStatement.contents.push(result)
                    self.advance_line()
                }
                return new SyntaxError(mainStatement, "Expected endif at end of if statement") // Not complete
            } else if (self.check_tag("endif")){ // Check for endif
                mainStatement.cases.push(currentIfStatement) // Pushes old if case
                this.continue()
                return mainStatement // complete
            } else {
                let result = self.parse() // Default
                if (result instanceof Error){
                    return result
                }
                currentIfStatement.contents.push(result) //Add AST to the currents contents
            }
            self.advance_line()
        }
        return new SyntaxError(mainStatement, "Expected endif at end of if statement") // Not complete
    }

    build_while_loop(self){
        let whileToken = self.token
        self.continue()
        if (self.token == null){
            return new SyntaxError(whileToken, "Expected condition after 'while'")
        }
        let condition = self.statement_chain(self)
        if (condition instanceof Error){
            return condition
        }
        whileToken.condition = condition
        self.continue()
        if (self.token != null){
            return new SyntaxError(self.token, "Expected no tokens after condition")
        }
        self.advance_line()
        while (self.currentTokens != null){
            self.continue()
            if (self.check_tag("endwhile")){
                this.continue()
                return whileToken
            }
            let result = self.parse()
            if (result instanceof Error){
                return result
            }
            whileToken.contents.push(result)
            self.advance_line()
        }
        return new SyntaxError(whileToken, "Expected 'endwhile' to close loop")
    }

    build_do_loop(self){
        let doToken = self.token //do 
        self.continue()
        if (self.token != null){
            return new SyntaxError(this.token, "Expeceted nothing to follow 'do'")
        }
        self.advance_line()
        while (self.currentTokens != null){ // adding contents
            self.continue()
            if (self.check_tag("until")){ // finishing loop
                self.continue()
                if (self.token == null){
                    return new SyntaxError(self.previous, "Expected condition after 'until'")
                }
                let condition = self.statement_chain(self) // get condition
                if (condition instanceof Error){
                    return condition
                }
                doToken.condition = condition
                if (self.token != null){
                    return new SyntaxError(self.token, "Expected no tokens after condition")
                }
                return doToken // returned
            }
            let result = self.parse() // default case
            if (result instanceof Error){
                return result
            }
            doToken.contents.push(result)
            self.advance_line()
        }
        return new SyntaxError(doToken, "Expected 'until' to close loop")
    }

    build_for_loop(self){
        let forToken = self.token // for
        self.continue()
        if (self.token == null){ // ensures tokena fter for
            return new SyntaxError(forToken, "Expected assignment after 'for'")
        }
        if (self.token instanceof TemplateKeyword){
            return new SyntaxError(self.token, "Expected identifier")
        }
        let result = self.assignment(self) //assignment
        if (result instanceof Error){
            return result
        }
        forToken.assignment = result
        forToken.variable = result.left
        if (self.token == null){
            return new SyntaxError(self.previous, "Expected 'to' to follow assignment")
        }
        if (!self.check_tag("to")){ // ensures next token is to
            return new SyntaxError(self.token, "Expected 'to'")
        }
        self.continue()
        if (self.token == null){
            return new SyntaxError(self.previous, "Expected expression after 'to'")
        }
        result = self.expression(self)
        if (result instanceof Error){
            return result
        }
        forToken.finish = result
        if (self.token == null){ // no step keyword
            forToken.step = new IntegerType(self.previous.position, self.previous.line, 1)
        } else {
            if (!self.check_tag("step")){ // ensures next token is step
                return new SyntaxError(self.token, "Expected 'step' or end of line")
            }
            self.continue()
            if (self.token == null){
                return new SyntaxError(self.previous, "Expected expression after 'step'")
            }
            result = self.expression(self)
            if (result instanceof Error){
                return result
            }
            forToken.step = result
            if (self.token != null){
                return new SyntaxError(self.token, "Expected end of line")
            }
        }
        self.advance_line()
        while (self.currentTokens != null){
            self.continue()
            if (self.check_tag("next")){
                self.continue()
                if (self.token == null){
                    return new SyntaxError(self.previous, `Expected '${forToken.variable.name}' after 'next'`)
                }
                if (!(self.token instanceof Identifier)){
                    return new SyntaxError(self.token, `Expected identifier named '${forToken.variable.name}'`)
                }
                if (self.token.name != forToken.variable.name){
                    return new SyntaxError(self.token, `Expected identifier to be named '${forToken.variable.name}'`)
                }
                self.continue()
                if (self.token != null){
                    return new SyntaxError(self.token, `Expected no tokens after '${forToken.variable.name}'`)
                }
                return forToken
            }
            let result = self.parse()
            if (result instanceof Error){
                return result
            }
            forToken.contents.push(result)
            self.advance_line()
        }
        return new SyntaxError(forToken, `Expected 'next ${forToken.variable.name}' to close loop`)
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

    parse_brackets(self, end, nextFunction){
        let bracket = self.token
        self.continue()
        if (self.check_tag(end)){
            return new SyntaxError(bracket, "'()' was empty")
        }
        let result = nextFunction(self)
        if (result instanceof Error){
            return result
        }
        if (self.check_tag(end)){
            self.continue()
            return result
        }
        return new SyntaxError(bracket, "'(' was never closed")
    }
}

////////////////
// EXECUTION
////////////////

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

    evaluate_loop(loop){
        let condition = loop.evaluate_condition()
        if (condition instanceof Error){
            output.push(condition.display())
            return 1
        }
        while (condition){
            if (this.evaluate_many_asts(loop.evaluate()) == 1){
                return 1    
            }
            condition = loop.evaluate_condition()
            if (condition instanceof Error){
                output.push(condition.display())
                return 1
            }
        }
        loop.reset()
        return 0
    }

    evaluate_single_ast(ast){
        if (ast instanceof IfStatement){
            let result = ast.evaluate()
            if (result instanceof Error){
                output.push(result.display())
                return 1
            }
            return this.evaluate_many_asts(result)
        }
        if (ast instanceof Loop){
            return this.evaluate_loop(ast)
        }
        if (ast instanceof Error){
            output.push(ast.display())
            return 1
        }
        if (ast == null){
            return 0
        }
        let evaluated = ast.evaluate()
        if (evaluated != null){
            output.push(evaluated.display())
        } 
        if (evaluated instanceof Error){
            return 1
        }
        return 0
    }

    evaluate_many_asts(asts){
        if (asts == null){
            return 0
        }
        for (let ast of asts){
            if (this.evaluate_single_ast(ast) == 1){
                return 1
            }
        }
        return 0
    }

    run(){
        if (!this.have_tokens){
            let result = this.make_tokens()
            if (result instanceof Error){
                output.push(result.display())
                return 1
            }
        }
        let parser = new Parser(this.tokens)
        let ast = parser.parse_next()
        while (ast != null){
            if (this.evaluate_single_ast(ast) == 1){
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
        output.push(`\nExited with code ${code}`)
    }
}

////////////////
// MAIN
////////////////

function main(){
    let testCases = fs.readFileSync("testCases.txt", 'utf8').split("\n$\n")
    let interpeter = new Interpreter()
    let success = 0
    for (let i = 0; i < testCases.length; i+= 2) {
        output = []
        interpeter.set_plaintext_manually(testCases[i])
        interpeter.run()
        if (output.join("\n") == testCases[i+1]){
            success++
        } else {
            console.log(`FAILURE\n${testCases[i]}\nGOT ${output}\nEXPECTED ${testCases[i+1].split("\n")}\n\n`)
        }
        global.table = []
    }
    console.log(`Success: ${success}/${testCases.length/2} = ${success/testCases.length*200}%`)
}

main()
 