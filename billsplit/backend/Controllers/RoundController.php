<?php
// app/Http/Controllers/RoundController.php
namespace App\Http\Controllers;

use App\Models\Round;
use App\Models\Expense;
use App\Models\Transfer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RoundController extends Controller
{
    public function index()
    {
        return Round::with('expenses', 'transfers')
            ->latest()
            ->get()
            ->map(fn($r) => [
                'id'        => $r->id,
                'name'      => $r->name,
                'total'     => $r->total,
                'members'   => $r->members,
                'skipped'   => $r->skipped,
                'created_at'=> $r->created_at->format('d M Y'),
                'expenses'  => $r->expenses,
                'transfers' => $r->transfers,
            ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'              => 'required|string',
            'members'           => 'required|array',
            'skipped'           => 'nullable|array',
            'expenses'          => 'required|array',
            'expenses.*.name'       => 'required|string',
            'expenses.*.amount'     => 'required|numeric',
            'expenses.*.raw_amount' => 'required|numeric',
            'expenses.*.vat'        => 'nullable|integer',
            'expenses.*.payer_name' => 'required|string',
            'expenses.*.split_with' => 'required|array',
            'transfers'         => 'nullable|array',
        ]);

        return DB::transaction(function () use ($data) {
            $total = collect($data['expenses'])->sum('amount');

            $round = Round::create([
                'name'    => $data['name'],
                'total'   => $total,
                'members' => $data['members'],
                'skipped' => $data['skipped'] ?? [],
            ]);

            foreach ($data['expenses'] as $e) {
                $round->expenses()->create([
                    'name'       => $e['name'],
                    'amount'     => $e['amount'],
                    'raw_amount' => $e['raw_amount'],
                    'vat'        => $e['vat'] ?? 0,
                    'payer_name' => $e['payer_name'],
                    'split_with' => $e['split_with'],
                ]);
            }

            foreach ($data['transfers'] ?? [] as $t) {
                $round->transfers()->create([
                    'from_name' => $t['from'],
                    'to_name'   => $t['to'],
                    'amount'    => $t['a'],
                ]);
            }

            return $round->load('expenses', 'transfers');
        });
    }

    public function show($id)
    {
        return Round::with('expenses', 'transfers')->findOrFail($id);
    }

    public function destroy($id)
    {
        Round::findOrFail($id)->delete();
        return response()->json(['ok' => true]);
    }

    public function markPaid($id)
    {
        $t = Transfer::findOrFail($id);
        $t->update(['paid' => !$t->paid]);
        return $t;
    }
}
