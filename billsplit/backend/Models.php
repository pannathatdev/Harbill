<?php
// app/Models/Friend.php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class Friend extends Model
{
    protected $fillable = ['name', 'phone', 'promptpay'];
}


// ─────────────────────────────────────────────────
// app/Models/Round.php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class Round extends Model
{
    protected $fillable = ['name', 'total', 'members', 'skipped'];
    protected $casts    = ['members' => 'array', 'skipped' => 'array'];

    public function expenses()  { return $this->hasMany(Expense::class); }
    public function transfers() { return $this->hasMany(Transfer::class); }
}


// ─────────────────────────────────────────────────
// app/Models/Expense.php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class Expense extends Model
{
    protected $fillable = ['round_id','name','amount','raw_amount','vat','payer_name','split_with'];
    protected $casts    = ['split_with' => 'array'];
}


// ─────────────────────────────────────────────────
// app/Models/Transfer.php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class Transfer extends Model
{
    protected $fillable = ['round_id','from_name','to_name','amount','paid'];
    protected $casts    = ['paid' => 'boolean'];
}
