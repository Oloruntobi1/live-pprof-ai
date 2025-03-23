package main

import (
	"fmt"
	"log"
	"math/rand"
	"net/http"
	_ "net/http/pprof"
	"sync"
	"time"
)

// Global variables to prevent garbage collection of our allocations
var (
	memoryLeakSimulator [][]byte
	mu                  sync.Mutex
)

// SimulatedWorkload represents a task that consumes CPU and memory
type SimulatedWorkload struct {
	data []byte
}

// DoWork simulates CPU-intensive computation
func (w *SimulatedWorkload) DoWork() {
	// CPU-intensive operation
	for i := 0; i < 1000000; i++ {
		_ = rand.Float64() * float64(i)
	}
}

// MemoryIntensiveTask simulates memory allocations
func MemoryIntensiveTask() {
	// Allocate memory in chunks
	chunk := make([]byte, 1024*1024) // 1MB
	for i := range chunk {
		chunk[i] = byte(rand.Intn(256))
	}

	mu.Lock()
	memoryLeakSimulator = append(memoryLeakSimulator, chunk)
	mu.Unlock()
}

// CPUIntensiveTask simulates CPU-heavy operations
func CPUIntensiveTask() {
	w := &SimulatedWorkload{
		data: make([]byte, 1024*1024), // 1MB allocation
	}

	// Perform CPU-intensive work
	w.DoWork()
}

// GoroutineLeakSimulator simulates goroutine leaks
func GoroutineLeakSimulator() {
	for i := 0; i < 5; i++ {
		go func() {
			// This goroutine will never exit
			select {}
		}()
	}
}

func backgroundTasks() {
	// Periodically run tasks
	ticker := time.NewTicker(100 * time.Millisecond)
	go func() {
		for range ticker.C {
			// Randomly choose which operation to perform
			switch rand.Intn(3) {
			case 0:
				CPUIntensiveTask()
			case 1:
				MemoryIntensiveTask()
			}
		}
	}()
}

func main() {
	// Print instructions
	fmt.Println("Server starting...")

	// Start background tasks
	backgroundTasks()

	// Memory cleanup every 30 seconds (partial cleanup to maintain some pressure)
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		for range ticker.C {
			mu.Lock()
			if len(memoryLeakSimulator) > 100 {
				// Keep some allocations to maintain memory pressure
				memoryLeakSimulator = memoryLeakSimulator[len(memoryLeakSimulator)-50:]
			}
			mu.Unlock()
		}
	}()

	// Start HTTP server with pprof endpoints
	log.Fatal(http.ListenAndServe(":6060", nil))
}
