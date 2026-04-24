package main

import (
	"log"

	"fileanaer/backend/internal/app"
	"fileanaer/backend/internal/config"
)

func main() {
	cfg := config.Load()
	server, err := app.NewServer(cfg)
	if err != nil {
		log.Fatal(err)
	}

	log.Printf("file-anaer listening on %s", cfg.Address())
	if err := server.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
