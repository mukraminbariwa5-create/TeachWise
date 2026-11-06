<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Throwable;

class CheckWise extends Command
{
    protected $signature = 'wise:check {--warm : Load the model before the first conversation}';

    protected $description = 'Check the chat database, Ollama connection and configured Wise model';

    public function handle(): int
    {
        try {
            if (! Schema::hasTable('chat_conversations') || ! Schema::hasColumns('chat_messages', ['request_id', 'source', 'conversation_id'])) {
                $this->error('Chat schema needs updating. Run php artisan migrate before chatting.');

                return self::FAILURE;
            }
        } catch (Throwable) {
            $this->error('TeachWise cannot reach its database. Start MySQL in XAMPP and check the backend database settings.');

            return self::FAILURE;
        }
        if (! config('services.ollama.enabled')) {
            $this->warn('Wise AI is disabled. Set OLLAMA_ENABLED=true and run php artisan config:clear.');

            return self::FAILURE;
        }
        $endpoint = rtrim(config('services.ollama.endpoint'), '/');
        $model = config('services.ollama.model');
        $tag = str_contains($model, ':') ? $model : $model.':latest';
        try {
            $response = Http::connectTimeout(3)->timeout(5)->retry(3, 300)->get($endpoint.'/api/tags')->throw();
            $installed = collect($response->json('models', []))->pluck('name');
            if (! $installed->contains($model) && ! $installed->contains($tag)) {
                $this->error("Wise model is missing. Install the configured model with: ollama pull {$model}");

                return self::FAILURE;
            }
            if ($this->option('warm')) {
                $this->info('Loading the Wise model...');
                Http::connectTimeout(3)->timeout(config('services.ollama.timeout'))
                    ->post($endpoint.'/api/generate', ['model' => $model, 'prompt' => '', 'stream' => false, 'keep_alive' => '15m'])->throw();
            }
        } catch (Throwable) {
            $this->error('Wise cannot use Ollama. Start Ollama on the API server, check OLLAMA_ENDPOINT, and ensure the server has enough free memory.');

            return self::FAILURE;
        }
        $this->info("Wise is ready: database connected; {$model} is installed and Ollama is reachable.");

        return self::SUCCESS;
    }
}
