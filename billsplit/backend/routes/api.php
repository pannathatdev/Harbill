<?php
// routes/api.php
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\FriendController;
use App\Http\Controllers\RoundController;

// ── Friends ──────────────────────────────────────
Route::get   ('/friends',        [FriendController::class, 'index']);
Route::post  ('/friends',        [FriendController::class, 'store']);
Route::put   ('/friends/{id}',   [FriendController::class, 'update']);
Route::delete('/friends/{id}',   [FriendController::class, 'destroy']);

// ── Rounds (ประวัติ) ──────────────────────────────
Route::get   ('/rounds',         [RoundController::class, 'index']);
Route::post  ('/rounds',         [RoundController::class, 'store']);
Route::get   ('/rounds/{id}',    [RoundController::class, 'show']);
Route::delete('/rounds/{id}',    [RoundController::class, 'destroy']);

// ── Mark transfer paid ────────────────────────────
Route::patch ('/transfers/{id}/paid', [RoundController::class, 'markPaid']);
