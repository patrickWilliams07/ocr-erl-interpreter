////////////////
// SYMBOL TABLE
////////////////

class SymbolTable {
    constructor(){
        this.table = []
    }

    get(token){
        for (let item of this.table){ // Checks if in current table
            if (item.name == token.name){
                return item.value
            }
        }
        if (this != Evaluator.global){ // If current table isnt global, checks global
            for (let item of Evaluator.global.table){
                if (item.name == token.name){
                    return item.value
                }
            }
        }
        return new IdentifierError(token, "was not declared") // Not defined
    }

    set(token, newValue){
        for (let item of this.table){ // Checks own table onlky
            if (item.name == token.name){
                return item.set(token, newValue)
            }
        }
        this.table.push(new Symbol(token)) // If doesn't exist, will create
        return this.table[this.table.length - 1].set(token, newValue)
    }

    push_native_subroutine(name, subroutine, tag=null){
        let symbol = new Symbol(new Identifier(null, null, name, true))
        if (tag == null){
            symbol.value = new subroutine(null, null)
        } else {
            symbol.value = new subroutine(null, null, tag)
        }
        this.table.push(symbol)
    }
}

class Symbol {
    constructor(token){
        this.name = token.name
        this.value = null
        this.constant = token.constant // Is a constant
        this.declared = false // If it is a constant, has it been declared
    }

    set(token, newValue){
        if (token.constant){ // Check if is now a constant
            this.constant = true
            this.declared = false
        }
        if (!this.constant){ // Normal variable
            this.value = newValue
            return null
        }
        if (this.declared){ // Constant and already defined
            return new IdentifierError(token, "is a constant and has already been defined")
        }
        this.declared = true // Defining a constant
        this.value = newValue
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
        let leftValueHolder = this.left.evaluate()
        this.rightValue = this.right.evaluate()
        this.leftValue = leftValueHolder
        if (this.contains_type(Error)){
            return this.leftValue instanceof Error ? this.leftValue : this.rightValue
        }
        if (this.contains_type(Return)){
            return new EvaluationError((this.leftValue instanceof Return ? this.leftValue : this.rightValue), "Cannot operate on subroutine with no return")
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
            return new TypeError(this, `Cannot concatenate type ${this.rightValue.typeAsString} with String, expected String`)
        } 
        if (this.leftValue instanceof IntegerType || this.leftValue instanceof FloatType){ // Number + ?
            return new TypeError(this, `Cannot add type ${this.rightValue.typeAsString} to ${this.leftValue.typeAsString}, expected Integer or Float`)
        } // ELSE
        return new TypeError(this, `Cannot combine types ${this.leftValue.typeAsString} and ${this.rightValue.typeAsString}`)
    }

    get_result = () => this.leftValue.value + this.rightValue.value
}

class Minus extends BinaryOperator{
    calculate(){
        if (this.contains_type(FloatType) && this.loose_type_check(FloatType, IntegerType)){ // Contains at least one float with potential integers
            return new FloatType(this.position, this.line, this.get_result()) // Definitely a float return
        }
        if (this.strict_type_check(IntegerType, IntegerType)){ // Contains two integers
            return new IntegerType(this.position, this.line, this.get_result()) // Definitely an integer return for addition
        } // ERRORS
        return new TypeError(this, `Cannot subtract type ${this.rightValue.typeAsString} from ${this.leftValue.typeAsString}, expected Integers or Floats`)
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
        return new TypeError(this, `Cannot mutltiply type ${this.leftValue.typeAsString} with ${this.rightValue.typeAsString}, expected Integers or Floats`)
    }

    get_result = () => this.leftValue.value * this.rightValue.value
}

class Divide extends BinaryOperator{
    calculate(){
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
        return new TypeError(this, `Cannot divide type ${this.rightValue.typeAsString} by ${this.leftValue.typeAsString}, expected Integes or Floats`)
    }

    get_result = () => this.leftValue.value / this.rightValue.value
}

class Exponent extends BinaryOperator{
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
        return new TypeError(this, `Cannot divide type ${this.rightValue.typeAsString} by ${this.leftValue.typeAsString}, expected Integers or Floats`)
    }

    get_result = () => this.leftValue.value ** this.rightValue.value
}

class Modulus extends BinaryOperator{
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
        return new TypeError(this, `Cannot take modulus of type ${this.leftValue.typeAsString} modulo ${this.rightValue.typeAsString}, expected Integers or Floats`)
    }

    get_result = () => this.leftValue.value % this.rightValue.value
}

class Quotient extends BinaryOperator{
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
        return new TypeError(this, `Cannot take the quotient of type ${this.leftValue.typeAsString} and ${this.rightValue.typeAsString}, expected Integers or Floats`)
    }

    get_result = () => Math.floor(this.leftValue.value / this.rightValue.value)
}

////////////////
// EQUALS
////////////////

class Equals extends BinaryOperator{
    evaluate(){
        this.rightValue = this.right.evaluate()
        if (this.leftValue instanceof Error){
            return this.leftValue
        }
        if (this.rightValue instanceof Error){
            return this.rightValue
        }
        return this.left.set(this.rightValue)
    }
}

////////////////
// LOGICAL
////////////////

class And extends BinaryOperator{
    calculate(){
        if (this.strict_type_check(BooleanType, BooleanType)){ // Contains two Booleans
            return new BooleanType(this.position, this.line, this.get_result()) // Expected result
        } // ERRORS
        return new TypeError(this, `Cannot use AND on type ${this.rightValue.typeAsString} with ${this.leftValue.typeAsString}, expected Booleans`)
    }

    get_result = () => this.leftValue.value && this.rightValue.value
}

class Or extends BinaryOperator{
    calculate(){
        if (this.strict_type_check(BooleanType, BooleanType)){ // Contains two Booleans
            return new BooleanType(this.position, this.line, this.get_result()) // Expected result
        } // ERRORS
        return new TypeError(this, `Cannot use OR on type ${this.rightValue.typeAsString} with ${this.leftValue.typeAsString}, expected Booleans`)
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
        return new TypeError(this, `Cannot use NOT on type ${childValue.typeAsString}, expected Boolean`)
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
        return new TypeError(this, `Cannot compare type ${this.rightValue.typeAsString} against ${this.leftValue.typeAsString}`)
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
    get typeAsString(){
        return "Integer"
    }

    display(){
        return String(this.value)
    }
    
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
    get typeAsString(){
        return "Float"
    }

    display(){
        if (String(this.value).includes('.')){
            return String(this.value)
        }
        return String(this.value) + ".0"
    }
    
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
    get typeAsString(){
        return "Boolean"
    }

    display(){
        return this.value ? "True" : "False"
    }

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
    get typeAsString(){
        return "String"
    }

    display(){
        return this.value
    }
    
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
// VARIABLES AND FUNCITONS
////////////////

class Identifier extends Token{
    constructor(position, line, name, constant=false){
        super(position, line)
        this.name = name
        this.constant = constant
        this.global = false
    }

    evaluate(){
        return Evaluator.currentScope.get(this)
    }

    set(newValue){
        return (this.global ? Evaluator.global : Evaluator.currentScope).set(this, newValue)
    }
}

class Call extends Token{
    constructor(position, line){
        super(position, line)
        this.callee = null
        this.argumentsAsts = []
    }

    evaluate(){
        let callee = this.callee.evaluate() // Ensures callee is valid datatpye
        if (callee instanceof Subroutine){
            return this.callee.evaluate().call(this)
        }
        if (callee instanceof Error){
            return callee
        }
        if (callee instanceof DataType){
            return new TypeError(this.callee, `Type ${callee.typeAsString} cannot be called`)
        }
        return new TypeError(this.callee, "Cannot call this")
    }
}

class Subroutine extends Token {
    static nullReturn = {typeAsString : "EmptySubroutineReturn"}

    get typeAsString(){
        return "Subroutine"
    }
}

class UserDefinedSubroutine extends Subroutine {
    static callStackSize = 0

    constructor(position, line, tag){
        super(position, line)
        this.tag = tag
        this.parameters = []
        this.contents = []
        this.identifier = null
    }

    call(call){
        if (UserDefinedSubroutine.callStackSize >= 1500){
            return new EvaluationError(call, "Call stack exceeded maximum size of 1500")
        }
        UserDefinedSubroutine.callStackSize++
        if (this.parameters.length != call.argumentsAsts.length){
            return new EvaluationError(call, `Subroutine expected ${this.parameters.length} arguments, ${call.argumentsAsts.length} given`)
        }
        let argumentsValues = []
        for (let i = 0; i < call.argumentsAsts.length; i++){ // First get argument values in old scope
            let result = call.argumentsAsts[i].evaluate()
            if (result instanceof Error){
                return result
            }
            argumentsValues.push(result)
        }
        let previousScope = Evaluator.currentScope // Then change
        Evaluator.currentScope = new SymbolTable()
        for (let i = 0; i < argumentsValues.length; i++){ // Then sets parmaters in new scope
            this.parameters[i].set(argumentsValues[i])
        }
        let result = new Evaluator().evaluate_many_asts(this.contents)
        if (result instanceof Error){
            return result
        }
        let returnValue
        if (result instanceof Return){
            returnValue = result.child.evaluate()
        } else {
            returnValue = Subroutine.nullReturn
        }
        Evaluator.currentScope = previousScope
        UserDefinedSubroutine.callStackSize--
        return returnValue
    }

    evaluate(){
        this.identifier.set(this)
    }
}

class Print extends Subroutine {
    call(call){
        let output = [] // output
        if (call.argumentsAsts.length == 0){ // Ensure 1 or more parameters
            return new EvaluationError(call, "print expected 1 or more arguments, 0 given")
        }
        for (let item of call.argumentsAsts){
            let result = item.evaluate()
            if (result instanceof Error){
                return result
            }
            if (!(result instanceof StringType)){
                return new EvaluationError(result, `Can only print type String, not ${result.typeAsString}`)
            }
            output.push(result.display())
        }
        console.log(output.join(' ')) // ONLY PRINT STATEMENT
        return Subroutine.nullReturn
    }
}

class Input extends Subroutine {
    call(call){
        if (call.argumentsAsts.length > 1){ // Ensure 1 parameter
            return new EvaluationError(call, `input expected 0 or 1 arguments, ${call.argumentsAsts.length} given`)
        }
        let message = ""
        if (call.argumentsAsts.length == 1){
            let result = call.argumentsAsts[0].evaluate()
            if (result instanceof Error){
                return result
            }
            if (!(result instanceof StringType)){
                return new EvaluationError(result, `Can only output type String, not ${result.typeAsString}`)
            }
            message = result.display() // Outputs input message
        }
        return new StringType(call.position, call.line, prompt(message))
    }
}

class Random extends Subroutine {
    call(call){
        if (call.argumentsAsts.length != 2){
            return new EvaluationError(call, `random expected 2 arguments, ${call.argumentsAsts.length} given`)
        }
        let min = call.argumentsAsts[0].evaluate()
        if (min instanceof Error){
            return min
        }
        let max = call.argumentsAsts[1].evaluate()
        if (max instanceof Error){
            return max
        }
        if (min instanceof IntegerType && max instanceof IntegerType){
            return new IntegerType(call.postition, call.line, Math.floor(Math.random() * (max.value - min.value + 1) + min.value))
        }
        if (start instanceof FloatType && max instanceof FloatType){
            return new FloatType(call.position, call.line, Math.random() * (max.value - min.value) + min.value)
        }
        return new TypeError(call, `Cannot use random on type ${min.typeAsString} with ${max.typeAsString}, expected two Integers or two Float`)
    }
}

class TypeCast extends Subroutine {
    constructor(position, line, tag){
        super(position,line)
        this.tag = tag
    }

    call(call){
        if (call.argumentsAsts.length != 1){
            return new EvaluationError(call, `${this.tag} expected 1 argument, ${call.argumentsAsts.length} given`)
        }
        let old = call.argumentsAsts[0].evaluate()
        if (old instanceof Error){
            return old
        }
        return old.cast_to_type(this.tag)
    }
}

class Asc extends Subroutine {
    call(call){
        if (call.argumentsAsts.length != 1){
            return new EvaluationError(call, `asc expected 1 argument, ${call.argumentsAsts.length} given`)
        }
        let character = call.argumentsAsts[0].evaluate()
        if (character instanceof Error){
            return character
        }
        if (!(character instanceof StringType)){
            return new TypeError(character, `Expected type String, not type ${character.typeAsString}`)
        }
        if (character.value.length != 1){
            return new TypeError(character, "Expexted single character, as string of length 1")
        }
        return new IntegerType(call.position, call.line, character.value.charCodeAt(0))
    }
}

class Chr extends Subroutine {
    call(call){
        if (call.argumentsAsts.length != 1){
            return new EvaluationError(call, `chr expected 1 argument, ${call.argumentsAsts.length} given`)
        }
        let code = call.argumentsAsts[0].evaluate()
        if (!(code instanceof IntegerType)){
            return new TypeError(code, `Expected type Integer, not type ${code.typeAsString}`)
        }
        return new StringType(call.position, call.line, String.fromCharCode(code.value))
    }
}


class Return extends Token {
    constructor(position, line){
        super(position, line)
        this.child = null
    }

    evaluate(){
        if (this.child == null){
            return null
        }
        return this.child.evaluate()
    }
}

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
                return new TypeError(result, `Condition must be type Boolean, not ${result.typeAsString}`)
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
            return new TypeError(condition, `Condition must be type Boolean, not ${condition.typeAsString}`)
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
            return new TypeError(condition, `Condition must be type Boolean, not ${condition.typeAsString}`)
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
            this.variable.set(this.variableValue)
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
}

class LexicalError extends Error {
    constructor(position, line, description='') {
        super(position, line)
        this.description = description
    }

    display(){
        return ` ! ERROR @line ${this.line}\nLexical Error: ${this.description}\n${this.location()}`
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

class EvaluationError extends Error {
    constructor(token, description='') {
        super(token.position, token.line)
        this.token = token
        this.description = description
    }

    display(){
        return ` ! ERROR @line ${this.line}\nEvaluation Error: ${this.description}\n${this.location()}`
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

class TypeError extends Error{
    constructor(token, description='') {
        super(token.position, token.line)
        this.token = token
        this.description = description
    }

    display(){
        return ` ! ERROR @line ${this.line}\nType Error: ${this.description}\n${this.location()}`
    }
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
            case "procedure":
            case "function":
                return new UserDefinedSubroutine(position, this.line, name)
            case "return":
                return new Return(position, this.line)
            case "const":
            case "global":
            case "then":
            case "endif":
            case "endwhile":
            case "until":
            case "to":
            case "step":
            case "next":
            case "endprocedure":
            case "endfunction":
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
    constructor(tokens, global){
        this.allTokens = tokens // All of the tokens in the program in an 2D array
        this.line = -1  // The current index of tokens in the array
        this.currentTokens = null // The corresponding line of tokens in an array
        this.position = -1 // The current position in the line
        this.token = null // The corresponding token for the position
        this.previous = null // The previous token
        this.allowReturn = false // True if a function is currently being parsed
        this.allowSubroutines = true // False if a subroutine is being parsed
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
        // Checks for a subroutine definition
        if (this.token instanceof UserDefinedSubroutine){
            if (this.allowSubroutines){
                return this.build_subroutine(this)
            }
            return new SyntaxError(this.token, "Cannot define a subroutine inside another subroutine")
        }
        // Check if it is a return statement
        if (this.token instanceof Return) {
            if (this.allowReturn){
                return this.return(this)
            }
            return new SyntaxError(this.token, "Can only use 'return' within functions")
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
        // Check if there is a tagged variable assignment
        if (this.check_tag("const", "global")){
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

    parse_arguments_or_parameters(self){
        self.continue()
        if (self.check_tag(')')){
            self.continue()
            return []
        }
        let argumentsOrParameters = []
        let argument = self.statement_chain(self)
        if (argument instanceof Error){
            return argument
        }
        argumentsOrParameters.push(argument)
        while (self.check_tag(',')){
            self.continue()
            if (self.token == null || self.check_tag(')')){
                return new SyntaxError(self.previous, "Expected next value to follow ','")
            }
            argument = self.statement_chain(self)
            if (argument instanceof Error){
                return argument
            }
            argumentsOrParameters.push(argument)
        }
        if (self.check_tag(')')){
            self.continue()
            return argumentsOrParameters
        }
        return new SyntaxError(self.token, "Expected ')' or ',' followed by additional argument")
    }

    factor(self){
        let result
        if (self.check_instance(DataType, Identifier)){
            result = self.token
            self.continue()
        } else if (self.check_tag('(')){
            result = self.parse_brackets(self, ')', self.statement_chain)
        } else if (self.check_instance(Add)){ // Add unary operator
            self.continue()
            if (self.token == null){
                return new SyntaxError(self.previous, "Incomplete input")
            }
            result = self.factor(self)
        } else if (self.check_instance(Minus)){ // Minus unary operator
            self.continue()
            if (self.token == null){
                return new SyntaxError(self.previous, "Incomplete input")
            }
            result = self.factor(self)
            if (result instanceof Error){
                return result
            }
            result.value = -result.value
        } else { // Two operators in a row
            return new SyntaxError(self.token, "Expected literal")
        }
        while (self.check_tag('(')){
            let call = new Call(self.token.position, self.token.line)
            let argumentsAsts = self.parse_arguments_or_parameters(self)
            if (argumentsAsts instanceof Error){
                return argumentsAsts
            }
            call.argumentsAsts = argumentsAsts
            call.callee = result
            result = call
        }
        return result
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
        if (self.check_tag("const", "global")){
            tag = self.token.tag
            self.continue()
        }
        let variable = self.token
        if (!(variable instanceof Identifier)){
            return new SyntaxError(variable, "Expected identifier")
        }
        variable.constant = tag == "const"
        variable.global = tag == "global"
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

    build_subroutine(self){
        self.allowReturn = self.token.tag == "function"
        self.allowSubroutines = false
        let subroutineToken = self.token // defining token
        self.continue()
        if (self.token == null ){ // function name
            return new SyntaxError(subroutineToken, `Expected identifier to follow ${subroutineToken.tag} decleration`)
        }
        if (!(self.token instanceof Identifier)){
            return new SyntaxError(self.token, `Expected identifier`)
        }
        subroutineToken.identifier = self.token
        self.continue()
        if (self.token == null){
            return new SyntaxError(self.previous, "Expected '(' to follow identifier")
        }
        if (!self.check_tag("(")){
            return new SyntaxError(self.token, "Expected '(' followed by arguments")
        }
        let parameters = self.parse_arguments_or_parameters(self) // checking parameters
        if (parameters instanceof Error){
            return parameters
        }
        for (let parameter of parameters){
            if (!(parameter instanceof Identifier)){
                return new SyntaxError(parameter, "Expected identifier as parameter")
            }
        }
        subroutineToken.parameters = parameters
        if (self.token != null){
            return new SyntaxError(self.token, "Expected no tokens following subroutine definition")
        }
        self.advance_line()
        while (self.currentTokens != null){ // adding contents
            self.continue()
            if (self.check_tag("end" + subroutineToken.tag)){ // closing clause
                this.continue()
                self.allowReturn = false
                self.allowSubroutines = true
                return subroutineToken
            }
            let result = self.parse()
            if (result instanceof Error){
                return result
            }
            subroutineToken.contents.push(result)
            self.advance_line()
        }
        return new SyntaxError(subroutineToken, "Expected 'endprocedure' to close procedure")
    }

    return(self){
        let returnToken = self.token
        self.continue()
        if (self.token == null){
            return returnToken
        }
        let result = self.statement_chain(self)
        if (result instanceof Error){
            return result
        }
        returnToken.child = result
        return returnToken
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
class Evaluator {
    static global = new SymbolTable()
    static currentScope = Evaluator.global

    evaluate_loop(loop){
        let condition = loop.evaluate_condition()
        if (condition instanceof Error){
            return condition
        }
        while (condition){
            let result = this.evaluate_many_asts(loop.evaluate())
            if (result != null){
                return result
            }
            condition = loop.evaluate_condition()
            if (condition instanceof Error){
                condition
            }
        }
        loop.reset()
        return null
    }

    evaluate_single_ast(ast){
        if (ast instanceof Return){
            return ast
        }
        if (ast instanceof IfStatement){
            let result = ast.evaluate()
            if (result instanceof Error){
                return result
            }
            return this.evaluate_many_asts(result)
        }
        if (ast instanceof Loop){
            return this.evaluate_loop(ast)
        }
        if (ast instanceof Error){
            return ast
        }
        if (ast == null){
            return
        }
        let evaluated = ast.evaluate()
        if (evaluated instanceof Error){
            return evaluated
        }
        // if (evaluated instanceof DataType){ // Old code to print everything
        //     console.log(evaluated.display())
        // }
        return null
    }

    evaluate_many_asts(asts){
        if (asts == null){
            return
        }
        for (let ast of asts){
            let result = this.evaluate_single_ast(ast)
            if (result != null){
                return result
            }
        }
        return null
    }
}

class Interpreter extends Evaluator{ 
    constructor(){
        super()
        this.plaintext = null
        this.tokens = []
        this.have_tokens = false
        this.build_global()
    }

    build_global(){
        Evaluator.global.push_native_subroutine("print", Print)
        Evaluator.global.push_native_subroutine("input", Input)
        Evaluator.global.push_native_subroutine("random", Random)
        Evaluator.global.push_native_subroutine("str", TypeCast, StringType)
        Evaluator.global.push_native_subroutine("int", TypeCast, IntegerType)
        Evaluator.global.push_native_subroutine("float", TypeCast, FloatType)
        Evaluator.global.push_native_subroutine("real", TypeCast, FloatType)
        Evaluator.global.push_native_subroutine("bool", TypeCast, BooleanType)
        Evaluator.global.push_native_subroutine("ASC", Asc)
        Evaluator.global.push_native_subroutine("CHR", Chr)
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
            let result = this.evaluate_single_ast(ast)
            if (result instanceof Error){
                console.log(result.display()) // all errors printed here
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

    debug_asts(fileName){
        this.get_plaintext_from_file(fileName)
        if (!this.have_tokens){
            let result = this.make_tokens()
            if (result instanceof Error){
                console.log(result.display())
            }
        }
        let parser = new Parser(this.tokens)
        let ast = parser.parse_next()
        while (ast != null){
            console.log(ast)
            ast = parser.parse_next()
        }
    }
}

////////////////
// MAIN
////////////////

let commandLineArguments = process.argv
main = new Interpreter()
if (arguments.length > 2){
    main.run_file(commandLineArguments[2])
}
