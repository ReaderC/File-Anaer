package naturalsort

import (
	"strings"
	"unicode"
)

func CompareFold(left, right string) int {
	leftRunes := []rune(strings.ToLower(left))
	rightRunes := []rune(strings.ToLower(right))
	leftIndex := 0
	rightIndex := 0

	for leftIndex < len(leftRunes) && rightIndex < len(rightRunes) {
		leftRune := leftRunes[leftIndex]
		rightRune := rightRunes[rightIndex]

		if unicode.IsDigit(leftRune) && unicode.IsDigit(rightRune) {
			leftStart := leftIndex
			for leftIndex < len(leftRunes) && unicode.IsDigit(leftRunes[leftIndex]) {
				leftIndex += 1
			}
			rightStart := rightIndex
			for rightIndex < len(rightRunes) && unicode.IsDigit(rightRunes[rightIndex]) {
				rightIndex += 1
			}

			if result := compareDigitRuns(leftRunes[leftStart:leftIndex], rightRunes[rightStart:rightIndex]); result != 0 {
				return result
			}
			continue
		}

		if leftRune != rightRune {
			if leftRune < rightRune {
				return -1
			}
			return 1
		}
		leftIndex += 1
		rightIndex += 1
	}

	switch {
	case leftIndex < len(leftRunes):
		return 1
	case rightIndex < len(rightRunes):
		return -1
	default:
		return 0
	}
}

func compareDigitRuns(left, right []rune) int {
	leftTrimmed := trimLeadingZeros(left)
	rightTrimmed := trimLeadingZeros(right)

	if len(leftTrimmed) != len(rightTrimmed) {
		if len(leftTrimmed) < len(rightTrimmed) {
			return -1
		}
		return 1
	}

	for index := 0; index < len(leftTrimmed) && index < len(rightTrimmed); index += 1 {
		if leftTrimmed[index] == rightTrimmed[index] {
			continue
		}
		if leftTrimmed[index] < rightTrimmed[index] {
			return -1
		}
		return 1
	}

	if len(left) != len(right) {
		if len(left) < len(right) {
			return -1
		}
		return 1
	}
	return 0
}

func trimLeadingZeros(value []rune) []rune {
	index := 0
	for index < len(value)-1 && value[index] == '0' {
		index += 1
	}
	return value[index:]
}
