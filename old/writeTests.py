with open("testCases.txt", 'a') as f:
    f.write("\n$")
    next = input()
    while next != "EXIT":
        if next == "-":
            f.write("\n$")
        else:
            f.write("\n"+next)
        next = input()
    f.close()
