<?php
// database/migrations/xxxx_create_friends_table.php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('friends', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('phone')->nullable();
            $table->string('promptpay')->nullable(); // เบอร์พร้อมเพย์
            $table->timestamps();
        });

        Schema::create('rounds', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->decimal('total', 10, 2)->default(0);
            $table->json('members');        // [id, id, ...]
            $table->json('skipped');        // [id, ...] มาแต่ไม่หาร
            $table->timestamps();
        });

        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('round_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->decimal('amount', 10, 2);
            $table->decimal('raw_amount', 10, 2);
            $table->integer('vat')->default(0);
            $table->string('payer_name');
            $table->json('split_with');     // [name, ...]
            $table->timestamps();
        });

        Schema::create('transfers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('round_id')->constrained()->cascadeOnDelete();
            $table->string('from_name');
            $table->string('to_name');
            $table->decimal('amount', 10, 2);
            $table->boolean('paid')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('transfers');
        Schema::dropIfExists('expenses');
        Schema::dropIfExists('rounds');
        Schema::dropIfExists('friends');
    }
};
