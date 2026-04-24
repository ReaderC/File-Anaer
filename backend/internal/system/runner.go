package system

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"
)

type Runner struct {
	Timeout time.Duration
}

type LineHandler func(string) error

func (r Runner) Run(name string, args ...string) ([]byte, error) {
	return r.RunContext(context.Background(), name, args...)
}

func (r Runner) RunContext(parent context.Context, name string, args ...string) ([]byte, error) {
	return r.RunContextWithInput(parent, nil, name, args...)
}

func (r Runner) RunContextWithInput(parent context.Context, input []byte, name string, args ...string) ([]byte, error) {
	ctx, cancel := r.commandContext(parent)
	defer cancel()

	cmd := exec.CommandContext(ctx, name, args...)
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if input != nil {
		cmd.Stdin = bytes.NewReader(input)
	}

	if err := cmd.Run(); err != nil {
		if ctx.Err() != nil {
			return nil, fmt.Errorf("%s timed out: %w", name, ctx.Err())
		}
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return nil, fmt.Errorf("%s failed: %s", name, msg)
	}

	return stdout.Bytes(), nil
}

func (r Runner) RunStreaming(name string, onStderrLine func(string), args ...string) ([]byte, error) {
	return r.RunStreamingContext(context.Background(), name, onStderrLine, args...)
}

func (r Runner) RunLineStreamingContext(parent context.Context, name string, onStdoutLine LineHandler, onStderrLine func(string), args ...string) error {
	ctx, cancel := r.commandContext(parent)
	defer cancel()

	cmd := exec.CommandContext(ctx, name, args...)
	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		return err
	}

	var stderr bytes.Buffer
	var handlerErr error
	var handlerErrMu sync.Mutex
	if err := cmd.Start(); err != nil {
		return err
	}

	recordHandlerErr := func(err error) {
		if err == nil {
			return
		}
		handlerErrMu.Lock()
		defer handlerErrMu.Unlock()
		if handlerErr == nil {
			handlerErr = err
			cancel()
		}
	}

	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		scanner := bufio.NewScanner(stdoutPipe)
		buffer := make([]byte, 0, 64*1024)
		scanner.Buffer(buffer, 1024*1024)
		for scanner.Scan() {
			line := scanner.Text()
			if onStdoutLine != nil {
				recordHandlerErr(onStdoutLine(line))
				if ctx.Err() != nil {
					return
				}
			}
		}
		if err := scanner.Err(); err != nil && !isIgnorablePipeReadError(err) {
			recordHandlerErr(err)
		}
	}()

	go func() {
		defer wg.Done()
		scanner := bufio.NewScanner(stderrPipe)
		buffer := make([]byte, 0, 64*1024)
		scanner.Buffer(buffer, 1024*1024)
		for scanner.Scan() {
			line := scanner.Text()
			if line == "" {
				continue
			}
			stderr.WriteString(line)
			stderr.WriteByte('\n')
			if onStderrLine != nil {
				onStderrLine(line)
			}
		}
		_ = scanner.Err()
	}()

	wg.Wait()
	err = cmd.Wait()

	handlerErrMu.Lock()
	capturedHandlerErr := handlerErr
	handlerErrMu.Unlock()
	if capturedHandlerErr != nil {
		return capturedHandlerErr
	}

	if err != nil {
		if ctx.Err() != nil {
			return fmt.Errorf("%s timed out: %w", name, ctx.Err())
		}
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return fmt.Errorf("%s failed: %s", name, msg)
	}

	return nil
}

func (r Runner) RunStreamingContext(parent context.Context, name string, onStderrLine func(string), args ...string) ([]byte, error) {
	ctx, cancel := r.commandContext(parent)
	defer cancel()

	cmd := exec.CommandContext(ctx, name, args...)
	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		return nil, err
	}

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	if err := cmd.Start(); err != nil {
		return nil, err
	}

	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		_, _ = io.Copy(&stdout, stdoutPipe)
	}()

	go func() {
		defer wg.Done()
		scanner := bufio.NewScanner(stderrPipe)
		buffer := make([]byte, 0, 64*1024)
		scanner.Buffer(buffer, 1024*1024)
		for scanner.Scan() {
			line := scanner.Text()
			if line == "" {
				continue
			}
			stderr.WriteString(line)
			stderr.WriteByte('\n')
			if onStderrLine != nil {
				onStderrLine(line)
			}
		}
	}()

	wg.Wait()
	err = cmd.Wait()
	if err != nil {
		if ctx.Err() != nil {
			return nil, fmt.Errorf("%s timed out: %w", name, ctx.Err())
		}
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return nil, fmt.Errorf("%s failed: %s", name, msg)
	}

	return stdout.Bytes(), nil
}

func (r Runner) commandContext(parent context.Context) (context.Context, context.CancelFunc) {
	if r.Timeout > 0 {
		return context.WithTimeout(parent, r.Timeout)
	}
	return context.WithCancel(parent)
}

func HasBinary(name string) bool {
	_, err := exec.LookPath(name)
	return err == nil
}

func isIgnorablePipeReadError(err error) bool {
	if err == nil {
		return false
	}
	return errors.Is(err, os.ErrClosed) || strings.Contains(strings.ToLower(err.Error()), "file already closed")
}
